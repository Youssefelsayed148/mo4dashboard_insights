import test from 'node:test';
import assert from 'node:assert/strict';
import { authorized } from '../lib/access.ts';
const env={DASHBOARD_USERNAME:'reviewer',DASHBOARD_PASSWORD:'fixture-password-long-enough'};
const header=(v:string)=>'Basic '+Buffer.from(v).toString('base64');
test('valid credentials pass',()=>assert.equal(authorized(header('reviewer:fixture-password-long-enough'),env),true));
test('wrong credentials and forged Sites headers cannot authorize',()=>{assert.equal(authorized(header('reviewer:wrong'),env),false);assert.equal(authorized(null,env),false);});
test('missing or short secrets fail closed',()=>{assert.equal(authorized(header('reviewer:fixture-password-long-enough'),{}),false);assert.equal(authorized(header('reviewer:abc'),{...env,DASHBOARD_PASSWORD:'abc'}),false);});
test('malformed and oversized headers rejected',()=>{assert.equal(authorized('Bearer token',env),false);assert.equal(authorized('Basic '+ 'A'.repeat(5000),env),false);});
