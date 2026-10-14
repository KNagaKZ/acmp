import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
import postgres from 'postgres';

nextEnv.loadEnvConfig(process.cwd());
const origin = process.env.TEST_ORIGIN ?? 'http://localhost:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, ssl: 'require' });
const accounts = [];
async function api(path, cookie = '', method = 'GET', body) {
  const response = await fetch(`${origin}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
try {
  const denied = await api('/api/groups'); assert.equal(denied.status,401);
  for (let n=0;n<2;n++) {
    const email=`migration-test-${randomUUID()}@example.invalid`;
    const registered=await api('/api/auth/register','','POST',{name:'Migration',surname:`Test ${n}`,email,password:'TestOnly-123456789'});
    assert.equal(registered.status,200,JSON.stringify(registered.body));
    const [teacher]=await sql`SELECT id FROM acmp.teachers WHERE email=${email}`;
    assert.ok(teacher.id); accounts.push({id:teacher.id,email,cookie:registered.cookie});
  }
  const first=accounts[0],other=accounts[1];
  assert.equal((await api('/api/admin/overview',first.cookie)).status,403);
  const created=await api('/api/groups',first.cookie,'POST',{name:'Migration verification group'});
  assert.equal(created.status,201);
  assert.ok(Array.isArray(created.body.groups)); const group=created.body.groups[0];
  const publicGroup=await api(`/api/standings/${group.slug}?refresh=1`); assert.equal(publicGroup.status,200); assert.equal(publicGroup.body.group.name,'Migration verification group'); assert.deepEqual(publicGroup.body.students,[]);
  const publicRegion=await api('/api/ranklists/north?refresh=1'); assert.equal(publicRegion.status,200); assert.ok(Array.isArray(publicRegion.body.students));
  const [student]=await sql`INSERT INTO acmp.students(teacher_id,name,surname,acmp_id) VALUES(${first.id},'Probe','Student','999999') RETURNING id`;
  const [foreign]=await sql`INSERT INTO acmp.students(teacher_id,name,surname,acmp_id) VALUES(${other.id},'Other','Student','999998') RETURNING id`;
  assert.equal((await api(`/api/groups/${group.id}`,other.cookie,'PATCH',{studentIds:[foreign.id]})).status,404);
  const saved=await api(`/api/groups/${group.id}`,first.cookie,'PATCH',{studentIds:[student.id,foreign.id],showGifts:true}); assert.equal(saved.status,200);
  const loaded=await api('/api/groups',first.cookie); assert.deepEqual(loaded.body.groups[0].studentIds,[student.id]);
  const members=await sql`SELECT student_id FROM acmp.group_students WHERE group_id=${group.id}`; assert.deepEqual(members.map(m=>m.student_id),[student.id]);
  const reward=await api(`/api/students/${student.id}/rewards`,first.cookie,'POST',{targetSolved:100,giftName:'Cup'}); assert.equal(reward.status,201); assert.ok(Array.isArray(reward.body.rewards));
  const gift=reward.body.rewards[0]; assert.equal((await api(`/api/students/${student.id}/rewards`,other.cookie,'PATCH',{rewardId:gift.id,delivered:true})).status,404);
  const delivery=await api(`/api/students/${student.id}/rewards`,first.cookie,'PATCH',{rewardId:gift.id,delivered:true}); assert.equal(delivery.body.rewards[0].delivered,1);
  const rank=await api('/api/ranklists/entries',first.cookie,'POST',{region:'south',entryType:'group',entryId:group.id}); assert.equal(rank.status,200);
  const listing=await api('/api/ranklists/entries',first.cookie); assert.equal(listing.body.entries[0].group_id,group.id);
  const teachersView=await api('/api/auth/login','','POST',{email:'admin',password:'Admin'}); assert.equal(teachersView.status,200);
  const overview=await api('/api/admin/overview',teachersView.cookie); assert.ok(overview.body.teachers.some(t=>t.id===first.id));
  const otp=await api(`/api/admin/teachers/${first.id}`,teachersView.cookie,'PATCH',{generateOneTime:true}); assert.ok(otp.body.oneTimePassword);
  const tempLogin=await api('/api/auth/login','','POST',{email:first.email,password:otp.body.oneTimePassword}); assert.equal(tempLogin.body.mustChangePassword,true);
  assert.equal((await api('/api/auth/login','','POST',{email:first.email,password:otp.body.oneTimePassword})).status,401);
  const password=await api('/api/auth/set-password',tempLogin.cookie,'POST',{password:'Changed-TestOnly-12345'}); assert.equal(password.status,200);
  const login=await api('/api/auth/login','','POST',{email:first.email,password:'Changed-TestOnly-12345'}); assert.equal(login.body.mustChangePassword,false);
  console.log('PASS: live registration, public group/regional standings, ownership denial, group save/readback, gift checkpoints, region entries, admin overview, single-use password and password change.');
} finally {
  // Only disposable accounts created by this test are removed; their children cascade.
  for(const account of accounts) await sql`DELETE FROM acmp.teachers WHERE id=${account.id} AND email=${account.email}`;
  await sql.end();
}
