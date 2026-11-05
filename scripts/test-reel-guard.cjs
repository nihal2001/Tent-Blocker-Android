const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(require('node:path').join(__dirname,'../app/src/main/assets/reel-guard.js'),'utf8');
function harness(path) {
  const events = {}, documentEvents = {}, classes = new Set(), attrs = new Set();
  const root = {classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},appendChild(){}};
  const scroller = {scrollHeight:2000,clientHeight:600,scrollTop:0,scrollLeft:0,parentElement:null,
    setAttribute:a=>attrs.add(a),removeAttribute:a=>attrs.delete(a),closest:()=>null};
  const video = {parentElement:scroller,closest:()=>null};
  const location = {origin:'https://www.instagram.com', pathname:path,
    get href(){return this.origin+this.pathname},replace(p){this.redirect=p;}};
  const document = {documentElement:root,scrollingElement:scroller,querySelectorAll:()=>[video],
    createElement:()=>({}),addEventListener:(name,fn)=>documentEvents[name]=fn};
  const window = {addEventListener:(name,fn)=>events[name]=fn};
  const history = {};
  for(const method of ['pushState','replaceState']) history[method]=(_,__,url)=>{if(url!=null)location.pathname=new URL(url,location.href).pathname;};
  vm.runInNewContext(source,{window,document,history,location,URL,MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>fn()});
  const event=(panel=false)=>({target:{closest:selector=>panel&&selector.includes('role=')?{querySelector:()=>null}:null},preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}});
  return {events,documentEvents,classes,attrs,scroller,location,history,event};
}
for(const route of ['/reel/one/','/reels/one/']) {
  const h=harness(route);
  assert(h.classes.has('tb-single-reel'));
  assert(h.attrs.has('data-tb-reel-scroll'));
  for(const type of ['touchmove','wheel']) {const e=h.event();h.events[type](e);assert(e.prevented&&e.stopped);}
  const comments=h.event(true);h.events.touchmove(comments);assert(!comments.prevented);
  const key=h.event();key.key='ArrowDown';h.events.keydown(key);assert(key.prevented);
  const back=h.event();back.key='Escape';h.events.keydown(back);assert(!back.prevented);
  h.scroller.scrollTop=600;h.documentEvents.scroll({target:h.scroller});assert.equal(h.scroller.scrollTop,0);
  h.history.replaceState({},'', '/reel/two/');assert.equal(h.location.redirect,'/reel/one/');assert.equal(h.location.pathname,route);
  h.history.pushState({},'', '/direct/t/chat/');assert(!h.classes.has('tb-single-reel'));assert(!h.attrs.has('data-tb-reel-scroll'));
  const free=h.event();h.events.wheel(free);assert(!free.prevented);
  h.history.pushState({},'', '/reel/two/');assert(h.classes.has('tb-single-reel'));assert.equal(h.location.pathname,'/reel/two/');
}
const home=harness('/');const e=home.event();home.events.touchmove(e);assert(!e.prevented);
const h=harness('/reel/one/');h.history.pushState({},'', '/reel/one/comments/');assert(!h.location.redirect);assert(!h.classes.has('tb-single-reel'));const commentScroll=h.event();h.events.wheel(commentScroll);assert(!commentScroll.prevented);
h.location.pathname='/direct/t/chat/';h.events.popstate();assert(!h.classes.has('tb-single-reel'));
console.log('Shared-reel guard regression tests passed.');

const modal=harness('/reel/one/');const modalGesture=modal.event();modalGesture.target.closest=selector=>selector.includes('role=')?{querySelector:()=>({})}:null;modal.events.touchmove(modalGesture);assert(modalGesture.prevented);
