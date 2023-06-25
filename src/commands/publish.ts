import path from "path";
import fs from "fs";
import tar from "tar";

import { exec, execSync } from "child_process";
import { Listr } from "listr2";
import { program as CommanderProgram } from "commander";

import extractPackageName, { extractedPackageInfo } from "../misc/extractPackageName.js";
import createHomeFolder, { localpmPackages, getlocalpmPackageJsonPath, getlocalpmPkgs } from "../misc/createHomeFolder.js";
import { backupJson } from "../misc/backupJson.js";
// import { pushaction } from "./push.js";

interface PublishContext {
    readPackageFile: any,
    packageinfo: extractedPackageInfo;
    tempFolderCleanupfunc?: () => void,
}

interface publishactionoptions {
    noScripts?: boolean,
    packer?: "pnpm"|"yarn"|"npm"
    // overwrite?: boolean,
    // push?: boolean,
    // migrate?: boolean,
}

export async function publishaction(packagePath:string,options:publishactionoptions){
    const MT = new Listr<PublishContext>(
        [
            {
                title: "Validate Package.json",
                task: async (ctx) => {
                    const exists = fs.existsSync(path.join(packagePath,"package.json"));
                    if(!exists){
                        throw new Error(`Could not resolve package.json file in "${packagePath}"`);
                    }
                    const readPackageFile =  JSON.parse(await fs.promises.readFile(path.join(packagePath,"package.json"),"utf8").catch(e => {
                        throw new Error(`Could not read package.json file ${e}`);
                    }));
                    if(!readPackageFile.name){
                        throw new Error(`Package is missing the "name" field.`)
                    }
                    const extractedInfo = extractPackageName(readPackageFile.name);

                    ctx.packageinfo = {
                        ...extractedInfo,
                        Version: readPackageFile.version,
                        }
                    ctx.readPackageFile = readPackageFile;
                    await createHomeFolder();
                }
            },
            {
                title: "Running lpm:prepublishOnly scripts",
                skip: options.noScripts,
                task: (ctx,task) => {
                    const Scripts = ctx.readPackageFile["scripts"];
                    if(Scripts){
                        const prepublishlocalpm = Scripts["lpm:prepublishOnly"];
                        if(prepublishlocalpm){
                            return new Promise<void>((resolve,reject) => {
                                const p = exec(prepublishlocalpm)
                                p.stdout.on("data", (data)=>{
                                    task.output = data
                                    console.log(data)
                                })
                                p.stderr.on("data", (data)=>{
                                    task.output = data
                                    console.log(data)
                                })
                                p.on("close", exitCode => {
                                    if(exitCode === 1){
                                        reject("lpm:prepublishOnly script failed")
                                    }
                                    resolve();
                                })
                            })
                            // const res = execSync(prepublishlocalpm,{stdio: "inherit", cwd: packagePath});
                            // task.title = task.title + " ==>> " + res.toString();
                        }else{
                            task.skip(`No "lpm:prepublishOnly" script found`)
                        }
                    }else{
                        task.skip(`No scripts field in package file`)
                    }
                }
            },
            {
                title: "Package & Publish",
                task: async (ctx, task) => {

                    task.output = "running pack program...";
                    //use pnpm to pack, npm is slow and yarn does not ignore files like "!**/*.tsbuildinfo" in the package files field.
                    execSync(`${options.packer} pack`, { cwd: packagePath, stdio: "ignore" });
                    const temppath = packagePath //since we no longer use temp dir, just point to package path, just incase we switch back in future
                    task.output = `packed gzip. ${temppath}`;
                    const localpmPkgsPath = getlocalpmPkgs();
                    const orgNameInlocalpm = ctx.packageinfo.Orginization || "@"; //Write files that aren't part of an orginization to a default @/ directory
                    const orgPathInlocalpm = path.join(localpmPkgsPath, orgNameInlocalpm);
                    task.output = `Writing path ${orgPathInlocalpm}...`;
                    try {
                        fs.mkdirSync(orgPathInlocalpm, { recursive: true });
                    }
                    catch (e) {
                        if (e.code !== "EEXIST") {
                            throw e;
                        }
                    }
                    //We use packageInOrgPath instead of binding to a specific @version since we're using symlinks now.
                    const packageInOrgPath = path.join(orgPathInlocalpm, ctx.packageinfo.Package);
                    await fs.promises.mkdir(packageInOrgPath).catch(e => {
                        if (e.code !== "EEXIST") {
                            throw e;
                        }
                    });
                    const localpmPackagesJson = JSON.parse(await fs.promises.readFile(await getlocalpmPackageJsonPath(true), "utf8").catch(e => { throw e; }));
                    const packageNameMap = ctx.packageinfo.Name;
                    //add to localpm-packages.json
                    task.output = "Assigning to global packages...";
                    Object.assign(localpmPackagesJson.packages, {
                        [packageNameMap]: {
                            // retain old installations if exists
                            installations: localpmPackagesJson.packages[packageNameMap] &&
                                localpmPackagesJson.packages[packageNameMap]["installations"]
                                || [],
                            //We use packageInOrgPath instead of binding to a specific @version since we're using symlinks now.
                            resolve: path.join(packageInOrgPath, "package"),
                        }
                    });
                    task.output = `Updating global packages...`;
                    await fs.promises.writeFile(await getlocalpmPackageJsonPath(), JSON.stringify(localpmPackagesJson, null, 2)).catch(e => {
                        throw e;
                    });
                    //unpack tarbal
                    task.output = `Extracting tarbal...`;
                    const tarbalName = (ctx.packageinfo.Orginization && (ctx.packageinfo.Orginization).replace("@","")+"-"+ctx.packageinfo.Package || ctx.packageinfo.Package)+`-${options.packer==="yarn"?"v":""}`+ctx.packageinfo.Version+".tgz";
                    const tarbalOutDirectory = path.join(temppath,tarbalName)
                    //remove any published package from the folder . packageName.package
                    try{
                        fs.rmSync(path.join(packageInOrgPath,"package"),{ recursive: true });
                    }catch(e) {
                        if(e.code !== "ENOENT"){
                            console.log(`You may need to manually remove this directory: ${packageInOrgPath}`)
                            throw e;
                        }
                    };

                    tar.x({
                        file: tarbalOutDirectory,
                        cwd: packageInOrgPath,
                        sync: true,

                    });
                    //remove tgz file
                    try{
                        fs.rmSync(tarbalOutDirectory,{ recursive: true })
                    }catch(e) {
                        if(e.code !== "ENOENT"){
                            console.log(`You may need to manually remove this directory: ${tarbalOutDirectory}`)
                            throw e;
                        }
                    };
                }
            }
        ]
        )
    await backupJson();
    await MT.run().then((ctx) => {
        console.log("published", ctx.packageinfo.Name+" v"+ctx.packageinfo.Version);
    }).catch(e => {
        // console.log(e);
    })
}

export default function publish(program: typeof CommanderProgram){
    program.command("publish")
    .option("--noScripts", "Do not execute any scripts", false)
    .option("--packer [string]", "What package manager to use to pack. npm,yarn,pnpm", "pnpm")
    // .option("--overwrite", "Overwrites any existing version without asking for permission.", false)
    // .option("--push", "Push changes after publishing.", false)
    // .option("--migrate", "Makes other version installations migrate to this release", false)
    .action(async (options) => {
        publishaction(process.cwd(),options)
    })
}