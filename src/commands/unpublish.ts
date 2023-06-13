import path from "path";
import fs from "fs";

import extractPackageName, { extractedPackageInfo } from "../misc/extractPackageName.js";

import { Listr } from "listr2";
import { program as CommanderProgram } from "commander";
import { localpmPackages, getlocalpmPackageJsonPath, getlocalpmPkgs } from "../misc/createHomeFolder.js";
import { execSync } from "child_process";


interface UnpublishContext {
    readPackageFile: any,
    packageinfo: extractedPackageInfo
    tempFolderCleanupfunc?: () => void,
}

export async function unpublishaction(packagePath:string,packageName:string | undefined){
    if(packageName){
        console.warn("\nWARN: Specified package to be unpublished instead of unpublishing from the packages directory, Make sure you're unpublishing the correct thing.\n\n")
    }
    const MT = new Listr<UnpublishContext>(
        [
            {
                title: "Validate Package.json",
                task: async (ctx) => {
                    if(packageName){
                        const d = extractPackageName(packageName);
                        if(d.Version !== "latest"){
                            ctx.packageinfo = d;
                        }else{
                            throw new Error(`Could not unpublish ${packageName} because the version could not be identified.`)
                        }
                        return;
                    }
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
                            Name: readPackageFile.name,
                            Version: readPackageFile.version,
                        }
                }
            },
            {
                title: "Verification",
                task: async (ctx,task) => {
                    await task.prompt({
                        type: "Toggle",
                        message: `ARE YOU SURE you want to unpublish "${ctx.packageinfo.Name}" version "${ctx.packageinfo.Version}"?`
                    }).then(e=>{
                        if(e === false){
                            process.exit(0);
                        }
                    })
                }
            },
            {
                title: "Unpublish",
                task: async (ctx,task) => {
                    const localpmFile = await getlocalpmPackageJsonPath();
                    if(localpmFile){
                        const d:localpmPackages = JSON.parse(await fs.promises.readFile(localpmFile,"utf8"))
                        const n = ctx.packageinfo.Name
                        const p = d.packages[n];
                        if(p === undefined){
                            task.skip(`Could not resolve in localpm-packages "${n}"`)
                            return;
                        }
                        const v = p[ctx.packageinfo.Version]
                        if(!v){
                            task.skip(`Could not resolve version in localpm-packages "${n}" => @${ctx.packageinfo.Version}`)
                            return
                        }
                        if(v.installations.length > 0){
                            await task.prompt({
                                message: `${n} is being used by (${v.installations.length}) files, unpublishing will remove the dependency from these files.\n\n${v.installations.join(",\n")}\n\n`,
                                type: "Toggle",
                            }).then(res=>{
                                if(res !== true){
                                    process.exit()
                                }
                            })
                        }
                        try{
                            fs.rmSync(v.resolve,{ recursive: true })
                        }catch(e) {
                            if(e.code !== "ENOENT"){
                                console.log(`You may need to manually remove this directory: ${v.resolve}`)
                                throw e;
                            }
                        };
                        
                        v.installations.map(e => {
                            //have installed version uninstall it.
                            console.log("Unpublish: removing from "+e)
                            execSync(`lpm remove ${n}@${ctx.packageinfo.Version}`,{cwd: e})
                        })
                        delete p[ctx.packageinfo.Version]
                        const _keys = Object.keys(p);
                        if(_keys.length < 1) {
                            //remove package if no version is published
                            delete d.packages[n];
                            //remove the folder aswell
                            const mrv = path.join(getlocalpmPkgs(),ctx.packageinfo.Orginization?ctx.packageinfo.Orginization:"",ctx.packageinfo.Name);
                            try{
                                fs.rmSync(mrv,{ recursive: true })
                            }catch(e) {
                                if(e.code !== "ENOENT"){
                                    console.log(`You may need to manually remove this directory: ${v.resolve}`)
                                    throw e;
                                }
                            };
                        }
                        await fs.promises.writeFile(localpmFile, JSON.stringify(d,null,2)).catch(e=>{
                            throw e;
                        })
                        
                    }
                }
            }
        ]
    )
    await MT.run().catch(e => {})
}



export default function unpublish(program: typeof CommanderProgram){
    program.command("unpublish")
    .argument("[package]","unpublish a specific package")
    .description("packs and unpublishes package locally")
    .action(async (pn,options) => {
        unpublishaction(process.cwd(),pn)
    })
}