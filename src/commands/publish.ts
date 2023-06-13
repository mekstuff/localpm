import path from "path";
import fs from "fs";
import tar from "tar";
import tmp from "tmp";

import { exec, execSync } from "child_process";
import { Listr } from "listr2";
import { program as CommanderProgram } from "commander";

import extractPackageName, { extractedPackageInfo } from "../misc/extractPackageName.js";
import createHomeFolder, { localpmPackages, getlocalpmPackageJsonPath, getlocalpmPkgs } from "../misc/createHomeFolder.js";
import { pushaction } from "./push.js";

interface PublishContext {
    readPackageFile: any,
    packageinfo: extractedPackageInfo;
    tempFolderCleanupfunc?: () => void,
}

interface publishactionoptions {
    noScripts?: boolean,
    overwrite?: boolean,
    push?: boolean,
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
                    // const { Orginization, Package } = extractPackageName(readPackageFile.name);
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
                title: "Running prepublishOnly scripts",
                skip: options.noScripts,
                task: (ctx,task) => {
                    const Scripts = ctx.readPackageFile["scripts"];
                    if(Scripts){
                        const prepublishOnly = Scripts["prepublishOnly"];
                        if(prepublishOnly){
                            const res = execSync(prepublishOnly);
                            task.title = task.title + " ==>> " + res.toString();
                        }else{
                            task.skip(`No "prepublishOnly" script found`)
                        }
                    }else{
                        task.skip(`No scripts field in package file`)
                    }
                }
            },
            {
                title: "Running prepublishlocalpm scripts",
                skip: options.noScripts,
                task: (ctx,task) => {
                    const Scripts = ctx.readPackageFile["scripts"];
                    if(Scripts){
                        const prepublishlocalpm = Scripts["prepublishlocalpm"];
                        if(prepublishlocalpm){
                            const res = execSync(prepublishlocalpm);
                            task.title = task.title + " ==>> " + res.toString();
                        }else{
                            task.skip(`No "prepublishlocalpm" script found`)
                        }
                    }else{
                        task.skip(`No scripts field in package file`)
                    }
                }
            },
            {
                title: "Packaging...",
                task: async (ctx, task) => {
                    await new Promise<void>((resolve,reject) => {
                        tmp.dir( {prefix: "localpm"}, async (err:string | undefined,temppath:string,cleanupcb:()=>void) => {
                            if(err){
                                throw err;
                            }
                            
                            ctx.tempFolderCleanupfunc = cleanupcb;
                            const npmpackexec = exec(`npm pack --pack-destination=${temppath}`,{cwd: packagePath})
                            npmpackexec.on("exit", async (code)=>{
                                if(code === 1) {
                                    const err = `Something went wrong when packing with npm. exited with code :: ${code}`
                                    console.log(err)
                                    reject(`Something went wrong when packing with npm. ::${code}`)
                                }
                                const pkgtgz = (await fs.promises.readdir(temppath).catch(e=>{
                                    reject(`Could not access tarbal ${e}`)
                                }))[0];
                                
                                const localpmPkgsPath = getlocalpmPkgs();
                                //check for the orginization in localpm pkgs. localpm/pkgs/@orginization
                                const orgNameInlocalpm = ctx.packageinfo.Orginization
                                const orgPathInlocalpm = path.join(localpmPkgsPath, orgNameInlocalpm);

                                try{
                                    fs.mkdirSync(orgPathInlocalpm, {recursive: true})
                                }catch (e) {
                                    if(e.code !== "EEXIST"){
                                        throw e;
                                    }
                                }
                                    await fs.promises.mkdir(orgPathInlocalpm).catch(e => {
                                        if(e.code !== "EEXIST"){
                                            throw e;
                                        }
                                    });
   

                                //check for the package in localpm pkgs within the given orginization. localpm/pkgs/@orginization/packagename
                                const packageInOrgPath = path.join(orgPathInlocalpm,ctx.packageinfo.Package);
                                if(!fs.existsSync(packageInOrgPath)){
                                    await fs.promises.mkdir(packageInOrgPath).catch(e => {
                                        if(e.code !== "EEXIST"){
                                            throw e;
                                        }
                                    });
                                }
                                
                                
                                //check for the package of the specific version in localpm pkgs within the given orginization. localpm/pkgs/@orginization/packagename/version.number.here
                                const packageVersionInOrgPath = path.join(packageInOrgPath,ctx.packageinfo.Version);
                                if(fs.existsSync(packageVersionInOrgPath)){
                                    //alert package with version already published
                                    if(!options.overwrite){
                                        await task.prompt({
                                            message: `${ctx.packageinfo.Name}@${ctx.packageinfo.Version} was already published, overwrite existing?`,
                                            type: "Toggle",
                                        }).then(r => {
                                            if(r !== true){
                                                reject(`Package was already published.`)
                                            }
                                        })
                                    }
                                    fs.rmSync(packageVersionInOrgPath,{recursive: true})
                                }
                                await fs.promises.mkdir(packageVersionInOrgPath).catch(e => {
                                    if(e.code !== "EEXIST"){
                                        throw e;
                                    }
                                });

                                //add to localpm-packages.json
                                const localpmPackagesJson:localpmPackages = JSON.parse(await fs.promises.readFile(await getlocalpmPackageJsonPath(true),"utf8").catch(e=>{throw e}));
                                const packageNameMap = ctx.packageinfo.Name;
                                localpmPackagesJson.packages[packageNameMap] = localpmPackagesJson.packages[packageNameMap] || {}
                                Object.assign(localpmPackagesJson.packages[packageNameMap], {
                                    [`${ctx.packageinfo.Version}`]: {
                                        //retain old installations if exists
                                        installations: localpmPackagesJson.packages[packageNameMap][ctx.packageinfo.Version] && 
                                        localpmPackagesJson.packages[packageNameMap][`${ctx.packageinfo.Version}`]["installations"]
                                         || [],
                                        resolve: path.join(packageVersionInOrgPath,"package"),
                                    }
                                })

                                await fs.promises.writeFile(await getlocalpmPackageJsonPath(),JSON.stringify(localpmPackagesJson,null,2)).catch(e => {
                                    throw e;
                                })

                                //unpack tarbal
                                tar.x(
                                    {
                                        file: path.join(temppath,pkgtgz),
                                        cwd: packageVersionInOrgPath,
                                        sync: true,
                                    }
                                )
   
                                cleanupcb();
                                ctx.tempFolderCleanupfunc = undefined;
                                resolve();
                            })
                        })
                    });
                },
                rollback: async (ctx): Promise<void> => {
                    if(ctx.tempFolderCleanupfunc){
                        ctx.tempFolderCleanupfunc();
                    }
                }
            },    
        ]
    )
    await MT.run().catch(e => {
        // console.log(e);
    }).then(_ => {
        if(options.push){
            pushaction(packagePath,{publish: false})
        }
    })
}

export default function publish(program: typeof CommanderProgram){
    program.command("publish")
    .option("--overwrite", "Overwrites any existing version without asking for permission.", false)
    .option("--push", "Push changes after publishing.", false)
    .option("--noScripts", "Do not execute any scripts", false)
    .option("--registry", "Publishes to registry aswell, will change dependencies to use ^... of the version", false)
    .description("packs and publishes package locally")
    .action(async (options) => {
        publishaction(process.cwd(),options)
    })
}