import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {crmActivities,dashboardMetrics,filterCrmActivities,initialState,saveActivity,saveLead} from "../src/sales/core.js";

const leadData={name:"Grand Horizon Hotel Dubai",contactPerson:"Maya",mobile:"+971 50 123 4567",email:"maya@grand-horizon.test",stage:"Qualified",interest:"Hotel management system",assignedSalesperson:"Asha Sharma",nextFollowup:"2026-08-26T10:30"};

test("a lead next follow-up is exposed as one derived activity linked by stable lead ID",()=>{
  const {state,record}=saveLead(initialState(),leadData);
  const activities=crmActivities(state);
  assert.equal(activities.length,1);
  assert.equal(activities[0].id,`LEAD-FOLLOWUP:${record.id}`);
  assert.equal(activities[0].relatedId,record.id);
  assert.equal(activities[0].lead.name,leadData.name);
  assert.equal(state.activities.length,0);
});

test("editing or removing next follow-up updates the derived entry without duplicates",()=>{
  let result=saveLead(initialState(),leadData),state=result.state,lead=result.record;
  state=saveLead(state,{...lead,nextFollowup:"2026-08-27T14:15"}).state;
  assert.deepEqual(crmActivities(state).map(a=>a.dateTime),["2026-08-27T14:15"]);
  state=saveLead(state,{...state.leads[0],nextFollowup:""}).state;
  assert.equal(crmActivities(state).length,0);
});

test("manual activities remain alongside derived lead follow-ups",()=>{
  let {state,record}=saveLead(initialState(),leadData);
  state=saveActivity(state,{relatedId:record.id,type:"Call",dateTime:"2026-08-26T09:00",status:"Pending",notes:"Confirm requirements"}).state;
  assert.equal(state.activities.length,1);
  assert.equal(crmActivities(state).length,2);
});

test("Today, Upcoming and Overdue use the actual follow-up date and time",()=>{
  const activities=[
    {id:"earlier",dateTime:"2026-08-26T09:00",status:"Pending"},
    {id:"later",dateTime:"2026-08-26T11:00",status:"Pending"},
    {id:"future",dateTime:"2026-08-27T10:30",status:"Pending"},
    {id:"done",dateTime:"2026-08-25T10:30",status:"Completed"}
  ],now=new Date(2026,7,26,10,30);
  assert.deepEqual(filterCrmActivities(activities,"today",now).map(a=>a.id),["earlier","later"]);
  assert.deepEqual(filterCrmActivities(activities,"upcoming",now).map(a=>a.id),["future"]);
  assert.deepEqual(filterCrmActivities(activities,"overdue",now).map(a=>a.id),["earlier"]);
});

test("dashboard follow-up metrics use the same combined source",()=>{
  let {state,record}=saveLead(initialState(),leadData);
  state=saveActivity(state,{relatedId:record.id,type:"Call",dateTime:"2026-08-25T09:00",status:"Pending"}).state;
  const metrics=dashboardMetrics(state,new Date(2026,7,26,10,0));
  assert.equal(metrics.todayFollowups,1);
  assert.equal(metrics.overdueFollowups,1);
});

test("Follow-ups renderer passes row arrays to the shared table helper",()=>{
  const source=readFileSync(new URL("../src/sales/app.js",import.meta.url),"utf8");
  const renderer=source.match(/function syncedFollowups\(\).*?\nfunction render/s)?.[0]||"";
  assert.match(renderer,/table\(\["When"[\s\S]*?rows\.map\(/);
  assert.doesNotMatch(renderer,/rows\.map\([\s\S]*?\.join\(""\)\):empty/);
});
