import path from "path";
import fs from "fs";
import { getlocalpmDirectory, getlocalpmPackageJsonPath } from "./createHomeFolder.js";

export function getBackupDirectory(){
    const lpmDirectory = getlocalpmDirectory()
    const backupsDirectoryPath = path.join(lpmDirectory, "backups")
    return backupsDirectoryPath;
}

export async function backupJson(noLogs?:boolean){
    const logInfo = (info:string) => {
        if(!noLogs){
            console.log(info);
        }
    }
    const JSON_STR = fs.readFileSync(await getlocalpmPackageJsonPath(true), "utf8")
    const JSON_Package = JSON.parse(JSON_STR);
    const backupsDirectoryPath = getBackupDirectory()
    const backupsExist = fs.existsSync(backupsDirectoryPath);
    if(!backupsExist){
        fs.mkdirSync(backupsDirectoryPath, {recursive: true})
    }
    const currDate = new Date()
    const DateString = currDate.toLocaleDateString().replace(/\//g,".");
    const TimeString = currDate.toLocaleTimeString().replace(/:/g,".");

    const FinalDir = path.join(backupsDirectoryPath, `localpm-packages-BACKUP @ ${TimeString} ${DateString}.json`)
    
    fs.writeFileSync(FinalDir, JSON.stringify(JSON_Package, null, 2));
    fs.readdirSync(backupsDirectoryPath).forEach((backupfile) => {
        const backupfilePath = path.join(backupsDirectoryPath, backupfile)
        if(backupfilePath !== FinalDir){
            try{
                const oldBackFilestr = fs.readFileSync(backupfilePath,"utf8");
                if(oldBackFilestr === JSON_STR){
                    logInfo(`Removing backupfile '${backupfile}' since data is the same as new backup.`)
                    fs.rmSync(backupfilePath)
                }
            }catch(e) {
                console.warn("Failed to work with previous backupfile => "+backupfilePath);
            }
        }
    })
    
}