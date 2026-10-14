import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createDatabase } from '../lib/db-core.ts';

test('Postgres migration supports private teacher records, goals, groups, ranklists and cascades', async () => {
  const pg = new PGlite();
  try {
    await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    await pg.exec(await readFile('supabase/migrations/20261014062319_acmp_schema.sql','utf8'));
    await pg.exec('SET ROLE acmp_app;');
    const db = createDatabase(async (query, values) => { const result = await pg.query(query, values); return { rows: result.rows, count: result.affectedRows ?? result.rows.length }; });
    const teacher = await db.prepare('INSERT INTO acmp.teachers (name,surname,email,password_hash) VALUES (?,?,?,?)').run('Teacher','One','teacher@example.com','hashed-password');
    const other = await db.prepare('INSERT INTO acmp.teachers (name,surname,email,password_hash) VALUES (?,?,?,?)').run('Teacher','Two','other@example.com','hash');
    assert.ok(teacher.lastInsertRowid);
    await assert.rejects(db.prepare('INSERT INTO acmp.teachers (name,surname,email,password_hash) VALUES (?,?,?,?)').run('X','Y','TEACHER@example.com','hash'), /duplicate key/);
    const student = await db.prepare('INSERT INTO acmp.students (teacher_id,name,surname,acmp_id) VALUES (?,?,?,?)').run(teacher.lastInsertRowid,'Islam',"O'Connor?",'470224');
    assert.equal(await db.prepare('SELECT id FROM acmp.students WHERE id=? AND teacher_id=?').get(student.lastInsertRowid, other.lastInsertRowid), undefined);
    assert.equal((await db.prepare('SELECT surname FROM acmp.students WHERE id=?').get(student.lastInsertRowid)).surname,"O'Connor?");
    const group = await db.prepare('INSERT INTO acmp.student_groups (teacher_id,name,slug) VALUES (?,?,?)').run(teacher.lastInsertRowid,'Class','class-test');
    await db.prepare('INSERT INTO acmp.group_students (group_id,student_id) VALUES (?,?)').run(group.lastInsertRowid,student.lastInsertRowid);
    const gift = await db.prepare('INSERT INTO acmp.student_rewards (student_id,target_solved,gift_name) VALUES (?,?,?)').run(student.lastInsertRowid,100,'Cup');
    assert.equal((await db.prepare('UPDATE acmp.student_rewards SET delivered=? WHERE id=?').run(1,gift.lastInsertRowid)).changes,1);
    await db.prepare('INSERT INTO acmp.ranklist_entries (teacher_id,region,entry_type,student_id) VALUES (?,?,?,?)').run(teacher.lastInsertRowid,'south','student',student.lastInsertRowid);
    await assert.rejects(db.prepare('INSERT INTO acmp.ranklist_entries (teacher_id,region,entry_type,student_id) VALUES (?,?,?,?)').run(teacher.lastInsertRowid,'kazakhstan','student',student.lastInsertRowid),/check constraint/);
    // Failed membership replacement must not erase the original membership.
    await assert.rejects(pg.transaction(async tx => {
      await tx.query('DELETE FROM acmp.group_students WHERE group_id=$1',[group.lastInsertRowid]);
      await tx.query('INSERT INTO acmp.group_students(group_id,student_id) VALUES ($1,$2)',[group.lastInsertRowid,999999]);
    }),/foreign key/);
    assert.equal((await db.prepare('SELECT * FROM acmp.group_students WHERE group_id=?').all(group.lastInsertRowid)).length,1);
    await assert.rejects(pg.exec('CREATE TABLE acmp.forbidden(id integer);'),/permission denied/);
    await pg.exec('RESET ROLE; SET ROLE anon;');
    await assert.rejects(pg.query('SELECT * FROM acmp.teachers'),/permission denied/);
    await pg.exec('RESET ROLE; SET ROLE authenticated;');
    await assert.rejects(pg.query('SELECT * FROM acmp.students'),/permission denied/);
    await pg.exec('RESET ROLE; SET ROLE acmp_app;');
    await db.prepare('DELETE FROM acmp.students WHERE id=?').run(student.lastInsertRowid);
    assert.equal((await db.prepare('SELECT * FROM acmp.student_rewards').all()).length,0);
    assert.equal((await db.prepare('SELECT * FROM acmp.group_students').all()).length,0);
    assert.equal((await db.prepare('SELECT * FROM acmp.ranklist_entries').all()).length,0);
  } finally { await pg.close(); }
});
