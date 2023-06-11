import fs from "fs";

import { program as CommanderProgram } from "commander"

import { getTwinePackageJsonPath, TwinePackageData, TwinePackages } from "../misc/createHomeFolder.js";
import extractPackageName, { extractedPackageInfo } from "../misc/extractPackageName.js";
import { Listr } from "listr2";
import path from "path";
import { updateaction } from "./update.js";
import { execSync } from "child_process";
import { removeaction } from "./remove.js";
import getPackageVersions, { addPathToInstallation, getPackageVersionData } from "../misc/getPackageVersions.js";

type AddContext = {
    extractedInfo: extractedPackageInfo
}

interface addactionoptions {
    noUpdate?: boolean
}

async function addaction(packagePath:string, packageName:string, options:addactionoptions){
    const MT = new Listr<AddContext>(
        [
            {
                title: "Validate Package.json",
                task: async () => {
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
                }
            },
            // {
            //     title: "Removing existing",
            //     task: async () => {
            //         execSync(`twine remove ${}`)
            //         // const exists = fs.existsSync(path.join(packagePath,"package.json"));
            //         // if(!exists){
            //         //     throw new Error(`Could not resolve package.json file in "${packagePath}"`);
            //         // }
            //         // const readPackageFile =  JSON.parse(await fs.promises.readFile(path.join(packagePath,"package.json"),"utf8").catch(e => {
            //         //     throw new Error(`Could not read package.json file ${e}`);
            //         // }));
            //         // if(!readPackageFile.name){
            //         //     throw new Error(`Package is missing the "name" field.`)
            //         // }
            //     },
                
            // },
            {
                title: `Adding ${packageName}`,
                task: async (ctx) => {
                    // const twinePackagesJson = await getTwinePackageJsonPath();
                    const extractedInfo = extractPackageName(packageName);
                    ctx.extractedInfo = extractedInfo;
                    const packageVersions = await getPackageVersions(extractedInfo.Name);
                    const QueryVersion = extractedInfo.Version == "latest" && packageVersions.at(-1) || extractedInfo.Version;

                    if(!packageVersions.find(e => e === QueryVersion)){
                        throw new Error(`Version "${QueryVersion}" of "${extractedInfo.Name}" is not published to twine.`)
                    }

                    //add to twine.lock
                    const LOCK_PATH = path.join(packagePath,"twine.lock")
                    if(!fs.existsSync(LOCK_PATH)){
                        await fs.promises.writeFile(LOCK_PATH,JSON.stringify({"packages":{}},null,2)).catch(e=>{throw e;});
                    }
                    const obj:any = JSON.parse(fs.readFileSync(LOCK_PATH).toString())
                    obj.packages = obj.packages || {};
                    obj.packages[extractedInfo.Name] = {
                        version: QueryVersion,
                        resolve: (await getPackageVersionData(extractedInfo.Name, QueryVersion)).resolve
                        // resolve: 
                    }
                    await fs.promises.writeFile(LOCK_PATH,JSON.stringify(obj,null,2)).catch(e=>{throw e;});
                    await addPathToInstallation(packagePath,extractedInfo.Name,QueryVersion);

                    //update so package manager will install

                    // execSync(`twine update ${extractedInfo.Name}`)

                    // const versionData = await getPackageVersionData(extractedInfo.Name,QueryVersion);
                    // console.log(versionData);

                    // console.log(obj);
                    // obj.packages[`${Data.Orginization}/${Data.Package}`] = {
                    //     resolve: packageData.resolve,
                    //     version: Data.Version,
                    // };
                    // await addToTwineLock(packagePath,PackageVersionData, {
                    //     Orginization: TargetOrginization,
                    //     Package: Package,
                    //     Version: VersionUsed,
                    // })

                    // if(!PackageVersionData.installations.find(_e=> _e === packagePath)){
                    //     PackageVersionData.installations.push(packagePath);
                    //     await fs.promises.writeFile(TwinePackages,JSON.stringify(TwinePackagesJSON,null,2)).catch(e=>{throw e});
                    // }
                    
                    // const targetVersion = packv
                    
                    // getPackageVersions(d.Name)
                    // console.log(semver.diff("1.2.3","1.2.5"))
                    // console.log(d);
                    // console.log(Orginization)
                    
            //         let TargetOrginization:string //incase orginization doesn't exists, use @ for twine, but not for package.json
            //         if(!Orginization){
            //             TargetOrginization = "@";
            //         }
            //         const TwinePackages = await getTwinePackageJsonPath();
            //         const n = `${TargetOrginization}/${Package}`;
            //         execSync(`twine remove ${n} --safe`)
            //         const TwinePackagesJSON:TwinePackages = JSON.parse(await fs.promises.readFile(TwinePackages,"utf8").catch(e=>{throw e}));
            //         const packageData = TwinePackagesJSON.packages[n];
            //         if(packageData === undefined){
            //             throw new Error(`${n} is not a package that is published to twine.`)
            //         }
            //         const [PackageVersionData,VersionUsed] = resolvePackageWithVersion(packageData,Version)
            //         if(!PackageVersionData){
            //             throw new Error(`"${n}" version "${Version}" could not be resolved. This version may not be published to twine.`);
            //         }
            //         ctx.targetPackageData = PackageVersionData;
            //         ctx.extractedPackageInfo = {
            //             Package: Package,
            //             Version: VersionUsed,
            //             Orginization: Orginization,
            //             TargetOrginization: Orginization,
            //         }
            //         await addToTwineLock(packagePath,PackageVersionData, {
            //             Orginization: TargetOrginization,
            //             Package: Package,
            //             Version: VersionUsed,
            //         })
            //         //add to installations array
                    // if(!PackageVersionData.installations.find(_e=> _e === packagePath)){
                    //     PackageVersionData.installations.push(packagePath);
                    //     await fs.promises.writeFile(TwinePackages,JSON.stringify(TwinePackagesJSON,null,2)).catch(e=>{throw e});
                    // }
                }
            },
            // {
            //     title: "Update package.json",
            //     task: async (ctx) => {
            //         const readPackageFile:{dependencies?: {[key: string]: string}} =  JSON.parse(await fs.promises.readFile(path.join(packagePath,"package.json"),"utf8").catch(e => {
            //             throw new Error(`Could not read package.json file ${e}`);
            //         }));
            //         readPackageFile.dependencies = readPackageFile.dependencies || {};
            //         readPackageFile.dependencies[ctx.extractedPackageInfo.Orginization?`@${ctx.extractedPackageInfo.Orginization}/${ctx.extractedPackageInfo.Package}`:ctx.extractedPackageInfo.Package] = `file:${ctx.targetPackageData.resolve}`;
            //         await fs.promises.writeFile(path.join(packagePath,"package.json"),JSON.stringify(readPackageFile,null,2)).catch(e=>{throw e});
            //         // await updateaction(packagePath, packageName)
            //         // console.log(ctx.extractedPackageInfo.Orginization)
            //     }
            // }
        ]
    )
    await MT.run().catch(e=>{

    }).then((f)=>{
        if(!options.noUpdate){
            updateaction((f as unknown as AddContext).extractedInfo.Name, packagePath)
        }
    })
}

export default function add(program: typeof CommanderProgram){
    program.command("add <packageName...>")
    .option("--noUpdate", "Does not run the update command, meaning it will not be installed via a package manager",false)
    .action(async (packageName:Array<string>, options) => {
        packageName.map(async (pn)=>{
            await addaction(process.cwd(),pn,options)
        })
        console.log(packageName);
    })
}