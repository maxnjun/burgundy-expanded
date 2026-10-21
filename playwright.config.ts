import { defineConfig } from "@playwright/test";
import {resolve} from "node:path";
export default defineConfig({
  testDir:"tests/browser",timeout:240_000,expect:{timeout:10_000},workers:1,fullyParallel:false,
  use:{baseURL:"http://127.0.0.1:3000",channel:"msedge",headless:true,trace:"retain-on-failure",screenshot:"only-on-failure"},
  projects:[
    {name:"mobile-375",use:{viewport:{width:375,height:812},hasTouch:true,isMobile:true}},
    {name:"mobile-390",use:{viewport:{width:390,height:844},hasTouch:true,isMobile:true}},
    {name:"tablet-768",use:{viewport:{width:768,height:1024},hasTouch:true}},
    {name:"desktop-1280",use:{viewport:{width:1280,height:900}}},
    {name:"iphone-webkit",use:{browserName:"webkit",channel:"",viewport:{width:390,height:844},hasTouch:true,isMobile:true}},
  ],
  webServer:{command:process.env.PLAYWRIGHT_PRODUCTION==="1"?"npm start":"npm run dev -- --hostname 127.0.0.1",...(process.env.PLAYWRIGHT_PRODUCTION==="1"?{env:{BURGUNDY_DATA_DIR:resolve(".local-data/browser-rooms"),GAME_VERSION:"development",APP_ORIGIN:"http://127.0.0.1:3000"}}:{}),url:"http://127.0.0.1:3000",reuseExistingServer:true,timeout:90_000},
});
