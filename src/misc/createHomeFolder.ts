import os from "os";
import path from "path";
import fs from "fs";

const DEFAULT_DIRECTORY = path.join(os.homedir(),".twine");

const DEFAULT_JSON_TEMPLATE = {
    "packages": {},
    "build-version": "0",
}

function catchErr(e: { code: string; }){
    if(e.code !== "EEXIST"){
        throw e;
    }
}

export async function createTwinePackagesJsonFile(){
    const twine_packages_json_path = path.join(DEFAULT_DIRECTORY,"twine-packages.json")
    const exists = fs.existsSync(twine_packages_json_path);
    if(exists){
        return;
    }
    await fs.promises.writeFile(path.join(twine_packages_json_path), JSON.stringify(DEFAULT_JSON_TEMPLATE,null,2),"utf8").catch(e => {
        throw e;
    });
}

export interface TwinePackageData {
    installations: Array<string>,
    resolve: string,
}

export interface TwinePackages {
    packages: {[key: string]: {[key: string]: TwinePackageData}},
    ["build-version"]: string,
}

export async function getTwinePackageJsonPath(createOnNonExist?:boolean): Promise<string>{
    const twine_packages_json_path = path.join(DEFAULT_DIRECTORY,"twine-packages.json")
    const exists = fs.existsSync(twine_packages_json_path);
    if(!exists){
        if(createOnNonExist){
            await createHomeFolder();
            // await createTwinePackagesJsonFile();
            return twine_packages_json_path;
        }
        throw new Error("Could not find twine-packages.json");
    }
    return twine_packages_json_path;
}

export function getTwineDirectory(){
    return DEFAULT_DIRECTORY;
}

export function getTwinePkgs(){
    return path.join(getTwineDirectory(), "pkgs");
}

export default async function createHomeFolder(){
    await fs.promises.mkdir(getTwineDirectory()).catch(catchErr);
    await fs.promises.mkdir(getTwinePkgs()).catch(catchErr);
    await createTwinePackagesJsonFile();
}