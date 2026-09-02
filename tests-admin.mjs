import assert from 'node:assert/strict';
const origin='http://localhost:3000';
async function req(path,body){const r=await fetch(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:'__sites_local_auth=1',Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()}}
assert.equal((await req('session')).body.user.id,'local_seedy');
const v=(await req('products')).body[0],supplier=(await req('suppliers')).body[0];
const p=await req('purchases',{supplierId:supplier.id,dueAt:'2026-10-01',items:[{variantId:v.id,quantity:2,cost:v.cost}]});assert.equal(p.status,201,JSON.stringify(p.body));
assert.equal((await req('actions',{action:'receive-purchase',id:p.body.id})).status,200);
assert.equal((await req('products')).body.find(x=>x.id===v.id).stock,v.stock+2);
assert.equal((await req('actions',{action:'receive-purchase',id:p.body.id})).status,409);
const count=await req('inventory',{items:[{variantId:v.id,counted:v.stock+1}]});assert.equal(count.status,201);
assert.equal((await req('actions',{action:'approve-count',id:count.body.id})).status,200);
assert.equal((await req('products')).body.find(x=>x.id===v.id).stock,v.stock+1);
assert.equal((await req('actions',{action:'approve-count',id:count.body.id})).status,409);
const stale=await req('inventory',{items:[{variantId:v.id,counted:v.stock+1}]});await req('stock',{variantId:v.id,quantity:1,reason:'Ajuste de prueba'});assert.equal((await req('actions',{action:'approve-count',id:stale.body.id})).status,409);
const expense=await req('expenses',{category:'Otros',description:'Prueba de integración',amount:100,date:'2026-09-02',methodId:'cash'});assert.equal(expense.status,201);
const cash=await req('cash');assert(cash.body.movements.some(x=>x.reference===expense.body.id&&x.amount===-100));
const payable=(await req('payables')).body.find(x=>x.description==='Compra recibida'&&x.status==='pending');assert(payable);assert.equal((await req('actions',{action:'pay-payable',id:payable.id,methodId:'transfer'})).status,200);assert.equal((await req('actions',{action:'pay-payable',id:payable.id,methodId:'transfer'})).status,409);
const expected=cash.body.session.opening+cash.body.balance.amount;assert.equal((await req('actions',{action:'close-cash',amount:expected})).status,200);assert.equal((await req('expenses',{category:'Otros',description:'Caja cerrada',amount:100,date:'2026-09-02',methodId:'cash'})).status,409);assert.equal((await req('actions',{action:'open-cash',amount:expected})).status,200);
for(const page of ['/pos','/admin/dashboard','/admin/products','/admin/cash','/admin/settings']){const r=await fetch(origin+page,{headers:{Cookie:'__sites_local_auth=1'}});assert.equal(r.status,200,page);await r.text()}
console.log('PASS: purchases, single receipt, counts, stale-count rejection, expense ledger, payable settlement, cash closure and server rendering.');
