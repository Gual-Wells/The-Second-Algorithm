import test from 'node:test';
import assert from 'node:assert/strict';
import {graphNextRoute,measureOneDriveProject,collectOneDriveUsage} from '../scripts/collect-service-snapshot.mjs';
const rootRoute='/me/drive/special/approot:/projects/second-algorithm?$select=id,folder';
const children=id=>`/me/drive/items/${id}/children?$select=id,size,file,folder,remoteItem&$top=200`;
function graph(routes){const calls=[];return{calls,async graphRequest(route){calls.push(route);if(!Object.hasOwn(routes,route))throw Error('unavailable fixture');const value=routes[route];if(value instanceof Error)throw value;return{async json(){return value;}};}};}
const quota={quota:{used:1000,total:100000000,remaining:99999000}};
test('project file listing ignores lagged zero folder totals and leaves account quota as the cloud snapshot',async()=>{
 const owner=graph({'/me/drive?$select=quota':quota,[rootRoute]:{id:'project',folder:{},size:0},[children('project')]:{value:[{id:'publications',folder:{},size:0}]},[children('publications')]:{value:[{id:'archive',file:{},size:6658503}]}});
 const report=await collectOneDriveUsage(owner,12345);assert.equal(report.verified,true);assert.equal(report.projectBytes,6658503);assert.equal(report.usedBytes,1000);assert.equal(report.checkedAt,12345);
 assert(owner.calls.filter(route=>route.includes('/children?')).length===2);assert(!owner.calls.some(route=>route.includes('/items/archive')));
});
test('listing follows valid pagination and nested folders without per-file reads',async()=>{
 const next='https://graph.microsoft.com/v1.0/me/drive/items/project/children?$skiptoken=page%2B2';
 const owner=graph({[rootRoute]:{id:'project',folder:{}},[children('project')]:{value:[{id:'first',file:{},size:5},{id:'nested',folder:{},size:0}],'@odata.nextLink':next},'/me/drive/items/project/children?$skiptoken=page%2B2':{value:[{id:'second',file:{},size:7}]},[children('nested')]:{value:[{id:'third',file:{},size:11}]}});
 assert.equal(await measureOneDriveProject(owner),23);assert.equal(owner.calls.length,4);assert(owner.calls.every(route=>route===rootRoute||route.includes('/children?')));
});
test('failed or incomplete directory measurement reports unknown, never a fabricated zero or partial total',async()=>{
 for(const broken of [new Error('network'),{value:[{id:'no-size',file:{}}]},{value:[{id:'first',file:{},size:5}],'@odata.nextLink':'https://evil.example/v1.0/elsewhere'}]){
  const owner=graph({'/me/drive?$select=quota':quota,[rootRoute]:{id:'project',folder:{},size:0},[children('project')]:broken});
  const report=await collectOneDriveUsage(owner,12345);assert.deepEqual(report,{id:'onedrive',verified:false,attemptedAt:12345});assert(!Object.hasOwn(report,'projectBytes'));
 }
});
test('pagination must remain HTTPS on the Graph v1.0 API and pagination loops fail closed',async()=>{
 for(const route of ['http://graph.microsoft.com/v1.0/me','https://evil.example/v1.0/me','https://graph.microsoft.com/beta/me','https://user@graph.microsoft.com/v1.0/me','https://graph.microsoft.com:444/v1.0/me','https://graph.microsoft.com/v1.0/me#fragment'])assert.throws(()=>graphNextRoute(route));
 const repeated='https://graph.microsoft.com/v1.0/me/drive/items/project/children?$select=id,size,file,folder,remoteItem&$top=200';
 const owner=graph({[rootRoute]:{id:'project',folder:{}},[children('project')]:{value:[],'@odata.nextLink':repeated}});await assert.rejects(measureOneDriveProject(owner));
});
