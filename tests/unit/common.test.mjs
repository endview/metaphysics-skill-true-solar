import test from 'node:test';import assert from 'node:assert/strict';
import {canonical,digest,parseStrictJson,pointer} from '../../runtime-src/common.mjs';
const code=(fn,c)=>assert.throws(fn,e=>e.code===c);
test('canonical key order produces the same digest',()=>assert.equal(digest({b:2,a:1}),digest({a:1,b:2})));
test('different inputs do not share the fixture digest',()=>assert.notEqual(digest({a:1}),digest({a:2})));
test('strict JSON round trip',()=>assert.deepEqual(parseStrictJson('{"a":[1,true,null,"x"],"b":{}}'),{a:[1,true,null,'x'],b:{}}));
for(const [name,source,error] of [
  ['top level duplicate','{"x":1,"x":2}','DUPLICATE_KEY'],
  ['nested duplicate','{"o":{"x":1,"x":2}}','DUPLICATE_KEY'],
  ['escaped duplicate','{"a":1,"\\u0061":2}','DUPLICATE_KEY'],
  ['prototype key','{"__proto__":{}}','UNSAFE_KEY'],
  ['nonfinite JSON','1e999','NONFINITE_NUMBER'],
  ['trailing data','{}{}','JSON_SYNTAX'],
  ['trailing comma','[1,]','JSON_SYNTAX'],
  ['invalid string','"a\nb"','JSON_SYNTAX'],
  ['invalid number','01','JSON_SYNTAX'],
  ['empty','', 'JSON_SYNTAX']
])test(`strict JSON rejects ${name}`,()=>code(()=>parseStrictJson(source),error));
test('JSON byte limit enforced',()=>code(()=>parseStrictJson('"abcdefgh"',{maxBytes:5}),'JSON_SIZE'));
test('JSON depth limit enforced',()=>code(()=>parseStrictJson('[[[0]]]',{maxDepth:2}),'JSON_DEPTH'));
test('canonical rejects undefined',()=>code(()=>canonical({x:undefined}),'NOT_JSON_DATA'));
test('canonical rejects sparse arrays',()=>code(()=>canonical(new Array(2)),'SPARSE_OR_EXTENDED_ARRAY'));
test('canonical rejects cycles',()=>{const x={};x.self=x;code(()=>canonical(x),'NOT_JSON_DATA');});
test('canonical rejects class instances',()=>code(()=>canonical(new Date()),'NOT_PLAIN_OBJECT'));
test('JSON pointer decodes slash and tilde',()=>assert.equal(pointer({'a/b':{'~':4}},'/a~1b/~0'),4));
test('JSON pointer array access',()=>assert.equal(pointer({a:[3]},'/a/0'),3));
for(const ref of ['$.a','/a/~9','/a/00','/a/-','/__proto__',''])
  test(`JSON pointer rejects invalid reference ${ref}`,()=>assert.throws(()=>pointer({a:[1]},ref)));
test('JSON pointer cannot reference another branch',()=>code(()=>pointer({a:1},'/other_branch/a'),'MISSING_BASIS'));
