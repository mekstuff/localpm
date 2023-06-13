import fs from "fs";
import path from "path";
import { program as CommanderProgram } from "commander";

import logTree from "console-log-tree";

type listStructureItem = {
    Package: string,
    Version: string,
    PackageManager?: string,
    Resolve?: string
}

import { Console } from "console";
import { Transform } from "stream";
import { localpmPackageData, localpmPackages, getlocalpmPackageJsonPath } from "../misc/createHomeFolder.js";
import extractPackageName from "../misc/extractPackageName.js";


function table(input) {
    // @see https://stackoverflow.com/a/67859384
    const ts = new Transform({ transform(chunk, enc, cb) { cb(null, chunk) } })
    const logger = new Console({ stdout: ts })
    logger.table(input)
    const table = (ts.read() || '').toString()
    let result = '';
    for (let row of table.split(/[\r\n]+/)) {
      let r = row.replace(/[^┬]*┬/, '┌');
      r = r.replace(/^├─*┼/, '├');
      r = r.replace(/│[^│]*/, '');
      r = r.replace(/^└─*┴/, '└');
      r = r.replace(/'/g, ' ');
      result += `${r}\n`;
    }
    console.log(result);
  }

export default function(program:typeof CommanderProgram){
    program.command("list")
    .argument("[targetPackage]", "list for a specific package only")
    .option("-a, --all ", "list all packages that are published to localpm and their installations")
    .option("--include-resolve","Add the resolve tab",false)
    .action( async (targetPackage:string | undefined, options) => {
        if(options.all){
            const localpmPackagesJson = await getlocalpmPackageJsonPath();
            if(!localpmPackagesJson){
                console.log("localpm package json file not found, publish a package first.")
                process.exit(1);
            }
            const JSONRead:localpmPackages = JSON.parse(await fs.promises.readFile(localpmPackagesJson,"utf8").catch(e=>{throw e}));
            const Tree = []
            for(const packageName in JSONRead.packages){
                const extractedInfo = extractPackageName(packageName)
                if(targetPackage !== undefined && targetPackage !== extractedInfo.Name){
                    continue;
                }
                const topLevel = {
                    "name": packageName,
                    "children": []
                }
                for(const packageVersion in JSONRead.packages[packageName]){
                    const nestedLevel = {
                        "name": packageVersion,
                        "children": [],
                    }
                    for(const installation of JSONRead.packages[packageName][packageVersion].installations) {
                        let useName = installation;
                        const children = [];

                        const filespackagejson = (await fs.promises.readFile(path.join(installation,"package.json"),"utf8").catch(()=>{
                            children.push({name: "WARN: File does not contain a package.json"})
                        }))
                        if(filespackagejson){
                            const filesjson = JSON.parse(filespackagejson);
                            if(filesjson.name){
                                useName = `${filesjson.name} => ${installation}`
                            }
                        }
                        const WITHIN_node_modules = fs.existsSync(path.join(installation,"node_modules",extractedInfo.Orginization?extractedInfo.Orginization:"",extractedInfo.Name));
                        if(!WITHIN_node_modules){
                            children.push({name: "WARN: not found node_modules",})
                        }
                        
                        await fs.promises.readFile(path.join(installation,"localpm.lock"),"utf8").then((res)=>{
                            const inLock = JSON.parse(res).packages[packageName];
                            if(!inLock){
                                children.push({name: "WARN: not found in localpm.lock",})
                            }
                        }).catch(()=>{
                            children.push({name: "WARN: could not read localpm.lock",})
                        })

                        nestedLevel.children.push({name: useName,children: children.length > 0 && children || undefined})
                    }
                    topLevel.children.push(nestedLevel);
                }
                Tree.push(topLevel);
            }
            console.log(logTree.parse(Tree));
            return
        }
        const listStructure:Array<listStructureItem> = [];
        const lock = JSON.parse(await fs.promises.readFile(path.join(process.cwd(),"localpm.lock"),"utf8").catch(e=>{
            throw e;
        }));
        for(const x in lock.packages){
            const data = lock.packages[x];
            const entry:listStructureItem = {
                Package: x,
                Version: data.version,
                PackageManager: data.pm || "UKNOWN",
            }
            if(options.includeResolve){
                entry.Resolve =  data.resolve
            }
            listStructure.push(entry)
        }
        table(listStructure);
    })
}