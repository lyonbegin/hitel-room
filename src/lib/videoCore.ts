// Thin TypeScript facade for video-town-front's separately built JS SDK.
export type CameraMode='mask'|'original';
export interface VideoCoreCameraSession {
 readonly stream: MediaStream;
 readonly mode: CameraMode;
 setMode: (mode:CameraMode)=>Promise<MediaStream>;
 enableMask: ()=>Promise<MediaStream>;
 disableMask: ()=>Promise<MediaStream>;
 getTrackingStatus: ()=>{fps:number}|null;
 stop: ()=>void;
}
interface VideoCoreInstance {openCamera:(options:{mode:CameraMode})=>Promise<VideoCoreCameraSession>}
interface VideoCoreModule {
 VIDEO_CORE_SDK_VERSION:string;
 VideoCore:{create:(options?:{diagnosticsBaseUrl?:string})=>Promise<VideoCoreInstance>};
}
let loadPromise:Promise<VideoCoreModule>|null=null;
async function loadSdk(){
 if(!loadPromise){
  const url='/sdk/video-core/video-core.esm.js';
  loadPromise=(import(/* @vite-ignore */ url) as Promise<VideoCoreModule>).catch(error=>{loadPromise=null;throw error;});
 }
 return loadPromise;
}
export async function openVideoCoreCamera(mode:CameraMode){
 const sdk=await loadSdk();
 const core=await sdk.VideoCore.create({diagnosticsBaseUrl:window.location.origin});
 return core.openCamera({mode});
}
