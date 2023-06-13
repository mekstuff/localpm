import { createRequire } from "module";
const require = createRequire(import.meta.url);

import fs from "fs";
import path from "path";
import chokidar from "chokidar";
import { exec, execSync } from "child_process";
import { program as CommanderProgram } from "commander";
import { publishaction } from "./publish.js";
import { pushaction } from "./push.js";

const { prompt } = require('enquirer');

type watchactionoptions = {
    ignore?: Array<string>
    publish: boolean
    push: boolean
    onTrigger: Array<string>
}

async function watchaction(packagePath:string, filesToWatch?:Array<string>, options?:watchactionoptions){
    if(typeof filesToWatch === "object" && filesToWatch.length === 0){
        filesToWatch = null;
    }
    if(!filesToWatch){
        const packageJSON = JSON.parse(await fs.promises.readFile(path.join(packagePath,"package.json"),"utf8").catch(e=>{
            throw new Error(`Could not watch ${packagePath} because to filesToWatch were passed and attempted to read package for files but failed. ${e}`);
        }));
        const FilesField = packageJSON["files"];
        if(FilesField){
            const x = await prompt({
                name: "usefiles",
                type: "select",
                message: "No filesToWatch was fulfilled and a \"files\" field was found within the package.json file, Should we watch only these files?",
                choices: ["Yes", "No"]
              });
              if(x.usefiles === "Yes"){
                const choices:Array<string> = []
                packageJSON["files"].map(async (f) => {
                    choices.push(path.join(packagePath,f));
                })
                const e = await prompt({
                    name: "include",
                    type: "multiselect",
                    choices: choices,
                });
                filesToWatch = e.include;
              }else{
                filesToWatch = [packagePath];
              }
        }
    }
    for(const x in filesToWatch) {
        let str = filesToWatch[x];
        str = path.relative(packagePath,str);
        if(str == ""){
            str = "./"
        }
        filesToWatch[x] = str;
    }
    if(!filesToWatch){
        filesToWatch = [packagePath];
    }

    function logWatching(){
        console.log("\n\n\n\nlocalpm Watching: "+filesToWatch.join(", "));
    }

    const watcher = chokidar.watch(filesToWatch,{
        ignoreInitial: true,
        ignored: options.ignore
    });
    watcher.on("all", (e,p) => {
        if(options.onTrigger){
            execSync(options.onTrigger.join(" "),{stdio: "inherit"})
            logWatching();
        }
    })
    process.on('SIGINT', () => {
        watcher.close().then(()=>{
            console.log("localpm Watch: Closed")
        }).catch(e=>{
            console.log(`Could not close watcher ${e}`)
        })
    });
    watcher.on("ready",()=>{
        logWatching();
    });

    /*
    if(!options.publish && !options.push){
        throw new Error(`No --push or --publish flag was set, so watching files will not make any sense. Please pass atleast one of these options`);
    }
    if(typeof filesToWatch === "object" && filesToWatch.length === 0){
        filesToWatch = null;
    }
    if(!filesToWatch){
        const packageJSON = JSON.parse(await fs.promises.readFile(path.join(packagePath,"package.json"),"utf8").catch(e=>{
            throw new Error(`Could not watch ${packagePath} because to filesToWatch were passed and attempted to read package for files but failed. ${e}`);
        }));
        const FilesField = packageJSON["files"];
        if(FilesField){
            const x = await prompt({
                name: "usefiles",
                type: "select",
                message: "No filesToWatch was fulfilled and a \"files\" field was found within the package.json file, Should we watch only these files?",
                choices: ["Yes", "No"]
              });
              if(x.usefiles === "Yes"){
                const choices:Array<string> = []
                packageJSON["files"].map(async (f) => {
                    choices.push(path.join(packagePath,f));
                })
                const e = await prompt({
                    name: "include",
                    type: "multiselect",
                    choices: choices,
                });
                filesToWatch = e.include;
              }else{
                filesToWatch = [packagePath];
              }
        }
    }
    for(const x in filesToWatch) {
        let str = filesToWatch[x];
        str = path.relative(packagePath,str);
        filesToWatch[x] = str;
    }
    const watcher = chokidar.watch(packagePath, {
        ignored: options.ignore,
    })
    process.on('SIGINT', () => {
        watcher.close().then(()=>{
            console.log("localpm Watch: Closed")
        }).catch(e=>{
            console.log(`Could not close watcher ${e}`)
        })
    });
    function logWatching(){
        console.log("\n\n\n\nlocalpm Watch: Watching "+filesToWatch.join(", "));
    }
    watcher.on("ready", ()=>{
        logWatching();
    });

    var currExecPanel;

    async function update(){
        console.log("change made");
    }
    
    watcher.on("add", update);
    watcher.on("unlink", update);
    watcher.on("change", update);

    watcher.on("change", async (path) => {
        update();
        let cmd:string;
        if(options.publish && options.push){
            cmd = "localpm publish --push --overwrite";
        }else{
            if(options.publish){
                cmd = "localpm publish --overwrite";
            }
            if(options.push){
                cmd = "localpm push";
            }
        }

        const executed = exec(cmd,{cwd: packagePath})
        currExecPanel = executed;
        executed.stdout.on("data", (data) => {
            console.log(data.toString());
        });
        executed.stderr.on("data", (data) => {
            // console.error(data);
        });
        executed.on("close", () => {
            currExecPanel = null;
        })
        logWatching();
    })
    */
}

export default function watch(program:typeof CommanderProgram){
    program.command("watch [files...]")
    .option("--ignore [files...]")
    .option("--onTrigger [scriptsToExecute...]")
    .action(async (files,options) => {
        watchaction(process.cwd(),files,options)
    })
}