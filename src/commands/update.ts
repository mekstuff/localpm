import fs from "fs";
import path from "path";

import { Listr } from "listr2";
import { program as CommanderProgram } from "commander";
import extractPackageName from "../misc/extractPackageName.js";
import { exec } from "child_process";

interface updateactionoptions {
    npm?: boolean,
    yarn?: boolean,
    pnpm?: boolean,
}

function getPackageManagerFromPath(Path:string):string|undefined {
    const yarnLock = fs.existsSync(path.join(Path,"yarn.lock"));
    if(yarnLock){
        return "yarn";
    }
    const npmlock = fs.existsSync(path.join(Path,"package-lock.json"));
    if(npmlock){
        return "npm";
    }
    const pnpmlock = fs.existsSync(path.join(Path,"pnpm-lock.json"));
    if(npmlock){
        return "pnpm";
    }
    return undefined;
}

export async function updateaction(packageName:string, packagePath:string,options?:updateactionoptions){
    options = options || {};
    const MT = new Listr(
        [
            {
                title: `Updating package "${packageName}"...`,
                task: async (_,task) => {
                    const LOCK_PATH = path.join(packagePath,"twine.lock")
                    const obj:any = JSON.parse(fs.readFileSync(LOCK_PATH).toString())

                    let pkginfo = extractPackageName(packageName);

                    const TwinePackageData = (obj.packages[pkginfo.Name])
                    if(!TwinePackageData){
                        throw new Error(`${packageName} is not managed by twine. Could not find in lock file.`);
                    }
                    const previouspm = TwinePackageData.pm;
                    let targetpm: string|undefined;
                    if(!options.npm && !options.yarn && !options.pnpm){
                        targetpm = getPackageManagerFromPath(packagePath);
                    }else{
                        targetpm = options.npm && "npm" || options.yarn && "yarn" || options.pnpm && "pnpm";
                    }
                    //if no package manager is defined then prompt for one.
                    if(!targetpm){
                        if(previouspm){
                            targetpm = previouspm
                        } else {
                            targetpm = await task.prompt({
                                    message: "Select a package manager",
                                    type: "Select",
                                    choices: ["yarn","npm","pnpm"]
                                })
                            }
                    }

                    if(previouspm !== targetpm){
                        //uninstall from previous package manager
                    }else{
                    }
                    TwinePackageData.pm = targetpm;
                    await fs.promises.writeFile(path.join(packagePath,"twine.lock"),JSON.stringify(obj,null,2),"utf8").catch(e=>{throw e});
                    
                    var prefix:string;
                    if(targetpm === "yarn"){
                        prefix = "yarn add"
                    }else if(targetpm === "npm"){
                        prefix = "npm install";
                    }else if(targetpm === "pnpm"){
                        prefix = "pnpm install";                        
                    }
                    
                    const execCMD = prefix+" file:"+TwinePackageData.resolve;
                    await new Promise<void>((resolve,reject) => {
                        const executedCommand = exec(execCMD,{cwd: packagePath})
                        executedCommand.stderr.on("data",(data:Buffer)=>{
                            console.log(data.toString())
                        })
                        executedCommand.on("close", (exitcode) => {
                        if(exitcode === 0){
                            resolve();
                        }else{
                            reject();
                        }
                    })
                })


                //     return new Promise<void>( async (resolve,reject) => {
                //         let targetpm: string|undefined;
                //         if(!options.npm && !options.yarn){
                //         targetpm = getPackageManagerFromPath(packagePath);
                //     }else{
                //         targetpm = options.npm && "npm" || options.yarn && "yarn";
                //     }
                //     //if no package manager is defined then prompt for one.
                //     if(!targetpm){
                //         targetpm = await task.prompt(
                //             {
                //                 message: "Select a package manager",
                //                 type: "Select",
                //                 choices: ["yarn","npm"]
                //             }
                //         )
                //     }

                //     const LOCK_PATH = path.join(packagePath,"twine.lock")
                //     const obj:any = JSON.parse(fs.readFileSync(LOCK_PATH).toString())
                //     const pkgs:Array<string> = [];
                //     for(const n in obj.packages) {
                //         const d:{resolve:string,pm?:string} = obj.packages[n];
                //         pkgs.push("file:"+d.resolve)
                //         obj.packages[n].pm = targetpm;
                //     }
                //     await fs.promises.writeFile(path.join(packagePath,"twine.lock"),JSON.stringify(obj,null,2),"utf8").catch(e=>{throw e});
                    
                    // var prefix;
                    // if(targetpm == "yarn"){
                    //     prefix = "yarn add"
                    // }else if(targetpm == "npm"){
                    //     prefix = "npm install";
                    // };
                    
                    // const execCMD = prefix+" "+pkgs.join(" ");
                    
                    // const executedCommand = exec(execCMD,{cwd: packagePath})
                    // executedCommand.stderr.on("data",(data:Buffer)=>{
                    //     console.log(data.toString())
                    // })
                    // executedCommand.on("close", (exitcode) => {
                    //     if(exitcode === 0){
                    //         resolve();
                    //     }else{
                    //         reject();
                    //     }
                    // })
                    
          
                // })
                }
            }
        ]
    )
    await MT.run().catch(e=>{

    })
}

export default function update(program: typeof CommanderProgram){
    program.command("update [packageName]")
    .action(async (packageName, options) => {
        if(packageName){
            updateaction(packageName,process.cwd(),options);
        }else{
            //loop through all packages and update them
        }
    })
}