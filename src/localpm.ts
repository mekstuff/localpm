#!/usr/bin/env node

import { exec } from "child_process";
import { getlocalpmDirectory, getlocalpmPackageJsonPath } from "./misc/createHomeFolder.js";


import { Command } from "commander";
var Program = new Command;

import add from "./commands/add.js";
add(Program);
import pull from "./commands/pull.js";
pull(Program);
import publish from "./commands/publish.js";
publish(Program);
import unpublish from "./commands/unpublish.js";
unpublish(Program);
/*
import push from "./commands/push.js";
push(Program);
import watch from "./commands/watch.js";
watch(Program);
*/
import list from "./commands/list.js";
list(Program);
import prepare from "./commands/prepare.js";
prepare(Program);
import remove from "./commands/remove.js";
remove(Program);

//open cmd
const opencmd = Program.command("open");
opencmd.command("folder")
.action(()=>{
    exec(`start "" "${getlocalpmDirectory()}"`)
})
opencmd.command("json")
.action(async ()=>{
    exec(`start "" "${await getlocalpmPackageJsonPath()}"`)
})


Program.parse();