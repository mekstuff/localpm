import fs from "fs";
import path from "path";
import { program as CommanderProgram } from "commander";
import { publishaction } from "./publish.js";
import { getlocalpmPackageJsonPath, localpmPackages } from "../misc/createHomeFolder.js";
import { Listr } from "listr2";
import extractPackageName, { extractedPackageInfo } from "../misc/extractPackageName.js";
import { exec } from "child_process";


type pushactioncontext = {
    packageinfo: extractedPackageInfo
}

type pushactionoptions = {
    publish: boolean;
}

export async function pushaction(packagePath:string,options?:pushactionoptions){
    if(options.publish){
        await publishaction(packagePath,{
            overwrite: true
        })
    }
    const FinalPublishTasks = []
    const MT = new Listr<pushactioncontext>(
        [
            {
                title: "Validating package.json",
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
                    const Version = readPackageFile.version;
                    ctx.packageinfo = {
                        ...extractedInfo,
                        Name: readPackageFile.name,
                        Version: readPackageFile.version,
                    }
                },
            },
            {
                title: "Pushing...",
                task: async (ctx,task) => {
                    const localpmPackages = await getlocalpmPackageJsonPath();
                    const localpmPackagesJSON:localpmPackages = JSON.parse(await fs.promises.readFile(localpmPackages,"utf8").catch(e=>{throw e}));
   
                    const n = ctx.packageinfo.Name;
                    const target = localpmPackagesJSON.packages[n];
                    if(target === undefined){
                        throw new Error(`Package "${n}" is not published, cannot push`);
                    }
                    const targetVer = target[ctx.packageinfo.Version];
                    if(!targetVer){
                        task.skip(`Package was published but version @${ctx.packageinfo.Version} was not, cannot push. Publish new version first`);
                    }
                    const execCmd = "lpm update "+ctx.packageinfo.Name;
                    let index = 0;
                    targetVer.installations.map((e) => {
                        index++
                        FinalPublishTasks.push({
                            title: `Updating ${e} (${index}/${targetVer.installations.length}) ${execCmd}...`,
                            task: (_,nt) => {
                                console.log(execCmd);
                                return new Promise<void>((resolve,reject) => {
                                    const executed = exec(execCmd,{cwd: e})
                                    executed.stdout.on("data", (data) => {
                                        nt.output = data.toString();
                                    })
                                    executed.on("close", (exitcode)=>{
                                        if(exitcode === 0){
                                            // resolve()
                                             //now push changes to those dependencies dependencies
                                            exec("localpm push",{cwd: e}).on("close",()=>{
                                                resolve()
                                            }).stdout.on("data",(d) => {
                                                nt.output = d.toString();
                                            })
                                        }else{
                                            reject()
                                        }
                                    })
                                });
                            },
                            exitOnError: false
                        })
                    })
                }
            }
        ]
    )
    await MT.run().then(()=>{
        // console.log(FinalPublishTasks)
        new Listr(FinalPublishTasks).run().catch(e=>{
            console.log(e);
        })
    })
    .catch(e=>{
        // throw e;
    })
    

}

export default function push(program:typeof CommanderProgram){
    program.command("push")
    .option("--publish", "Publish first, then push changes to installations")
    .action(async (options) => {
        pushaction(process.cwd(),options)
    })
}