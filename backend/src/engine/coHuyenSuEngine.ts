// ========================================================
// CỜ HUYỀN SỬ: SERVER-AUTHORITATIVE COMBAT & RULES ENGINE
// 100% Logic bàn cờ, Tướng, Chiêu thức, Giao tranh & Kinh tế
// ========================================================

// @ts-nocheck

'use strict';
const W=8,HH=7,TICK=0.05,MOVE_CD=0.45;
const HPC=[560,720,900,1150,1500],ADC=[48,60,76,100,135],SKM=[1,1.7,2.8];
const COSTCOL=['#8e8777','#2e9c80','#3f72d1','#9a4fc4','#d9a22b'];
const ODDS=[null,[100,0,0,0,0],[100,0,0,0,0],[75,25,0,0,0],[55,30,15,0,0],[45,33,20,2,0],[25,40,30,5,0],[17,30,35,15,3],[16,25,32,22,5],[10,15,25,35,15]];
const XPN={2:2,3:6,4:10,5:20,6:36,7:56,8:64};
const PVE_ROUNDS=[1,2,3,8,15,22];
const PVE_RW={1:{cost:1},2:{cost:1},3:{cost:2},8:{cost:3,relic:1},15:{cost:4,relic:1},22:{cost:5,relic:1}};
const rnd=n=>Math.floor(Math.random()*n);
const pickOf=a=>a[rnd(a.length)];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
let UID=1;
/* giá trị theo sao: mảng = riêng từng sao; số = tự nhân hệ số SKM */
function sv(v,s){return Array.isArray(v)?v[s-1]:v;}
function sc(v,s){return Array.isArray(v)?v[s-1]:v*SKM[s-1];}

const CS={
  chienbinh:{name:'Chiến Binh',ico:'⚔️',hp:1.05,ad:1,armor:35,range:1,as:.7,mana0:0,crit:0},
  hove:{name:'Hộ Vệ',ico:'🛡️',hp:1.4,ad:.65,armor:60,range:1,as:.55,mana0:20,crit:0},
  cungno:{name:'Cung Nỏ',ico:'🏹',hp:.78,ad:1,armor:15,range:4,as:.85,mana0:0,crit:.05},
  thuatsi:{name:'Thuật Sĩ',ico:'✨',hp:.75,ad:.7,armor:10,range:3,as:.65,mana0:10,crit:0},
  dukich:{name:'Du Kích',ico:'🗡️',hp:.85,ad:1.1,armor:25,range:1,as:.9,mana0:0,crit:.15},
  summon:{name:'Triệu Hồi',ico:'🐉',hp:1,ad:1,armor:15,range:1,as:.8,mana0:0,crit:0}
};
const TR={
  hongbang:{name:'Hồng Bàng',kind:'Tộc',ico:'🐉',col:'#e0a93b',scope:'self',desc:'Con Rồng cháu Tiên, thuở dựng nước. Tướng Hồng Bàng mạnh kỹ năng và vào trận với sẵn nộ.',tiers:[{n:2,fx:{spell:.25,mana:10}},{n:4,fx:{spell:.55,mana:25}},{n:6,fx:{spell:1,mana:45}}]},
  aulac:{name:'Âu Lạc',kind:'Tộc',ico:'🏯',col:'#8fbf7a',scope:'team',desc:'Thành Cổ Loa, nỏ thần Kim Quy. Cả đội được thêm giáp.',tiers:[{n:2,fx:{armor:20}},{n:4,fx:{armor:50}}]},
  khoinghia:{name:'Khởi Nghĩa',kind:'Tộc',ico:'🔥',col:'#e0603f',scope:'self',desc:'Đứng lên giành lại giang sơn. Tướng Khởi Nghĩa đánh nhanh hơn.',tiers:[{n:2,fx:{as:.2}},{n:4,fx:{as:.45}},{n:6,fx:{as:.8}}]},
  lytran:{name:'Lý \u2013 Trần',kind:'Tộc',ico:'🌊',col:'#5b8fdc',scope:'team',desc:'Hào khí Đông A. Cả đội được thêm máu tối đa.',tiers:[{n:2,fx:{hp:.12}},{n:4,fx:{hp:.3}},{n:6,fx:{hp:.55}}]},
  lamson:{name:'Lam Sơn',kind:'Tộc',ico:'🗡️',col:'#4fb577',scope:'team',desc:'Lam Sơn tụ nghĩa. Cả đội được thêm sát thương.',tiers:[{n:2,fx:{ad:.15}},{n:4,fx:{ad:.4}}]},
  tayson:{name:'Tây Sơn',kind:'Tộc',ico:'🐘',col:'#f08a3c',scope:'self',desc:'Thần tốc Tây Sơn. Tướng Tây Sơn thêm sát thương và hút máu.',tiers:[{n:2,fx:{ad:.25,ls:.12}},{n:3,fx:{ad:.5,ls:.25}}]},
  chienbinh:{name:'Chiến Binh',kind:'Hệ',ico:'⚔️',col:'#cdbf9f',scope:'self',desc:'Tiền tuyến vững chãi. Chiến Binh thêm giáp.',tiers:[{n:2,fx:{armor:25}},{n:4,fx:{armor:60}},{n:6,fx:{armor:110}}]},
  hove:{name:'Hộ Vệ',kind:'Hệ',ico:'🛡️',col:'#cdbf9f',scope:'self',desc:'Lá chắn của đội. Hộ Vệ thêm máu tối đa.',tiers:[{n:2,fx:{hp:.2}},{n:4,fx:{hp:.45}},{n:6,fx:{hp:.9}}]},
  cungno:{name:'Cung Nỏ',kind:'Hệ',ico:'🏹',col:'#cdbf9f',scope:'self',desc:'Bắn từ xa. Cung Nỏ đánh nhanh hơn.',tiers:[{n:2,fx:{as:.25}},{n:4,fx:{as:.6}},{n:6,fx:{as:1.1}}]},
  thuatsi:{name:'Thuật Sĩ',kind:'Hệ',ico:'✨',col:'#cdbf9f',scope:'self',desc:'Pháp thuật huyền bí. Thuật Sĩ tăng sức mạnh kỹ năng.',tiers:[{n:2,fx:{spell:.3}},{n:4,fx:{spell:.7}},{n:6,fx:{spell:1.3}}]},
  dukich:{name:'Du Kích',kind:'Hệ',ico:'🗡️',col:'#cdbf9f',scope:'self',desc:'Đầu trận nhảy ra sau lưng địch. Du Kích thêm chí mạng và sát thương.',tiers:[{n:2,fx:{crit:.2,ad:.1}},{n:4,fx:{crit:.45,ad:.2}}]}
};
const FXN={hp:['% máu',1],ad:['% sát thương',1],as:['% tốc đánh',1],armor:[' giáp',0],spell:['% sức mạnh kỹ năng',1],crit:['% chí mạng',1],ls:['% hút máu',1],mana:[' nộ khởi đầu',0]};
function fxText(fx){return Object.keys(fx).map(k=>'+'+(FXN[k][1]?Math.round(fx[k]*100):fx[k])+FXN[k][0]).join(', ');}

/* ===== Hệ thống Nhân Duyên Huyền Sử (Chỉ các bộ có quan hệ trực tiếp) ===== */
const BONDS=[
  {id:'leloi_lelai',name:'Liều Mình Cứu Chúa',ico:'🗡️',heroes:['leloi','lelai'],scope:'members',desc:'Lê Lai liều mình đổi áo bào cứu Lê Lợi tại núi Chí Linh. Cả 2 tăng 10% Sát thương; Lê Lai thêm 25 Giáp, Lê Lợi vào trận nhận 20 Nộ.',fx:{ad:.1,armor:25,mana:20}},
  {id:'trungtrac_trungnhi',name:'Mê Linh Đồng Khởi',ico:'🌺',heroes:['trungtrac','trungnhi'],scope:'members',desc:'Hai Bà Trưng phất cờ khởi nghĩa Mê Linh đền nợ nước trả thù nhà. Cả 2 tăng 25% Tốc đánh và 25 Nộ khởi đầu.',fx:{as:.25,mana:25}},
  {id:'sontinh_thuytinh',name:'Sơn Thần Thủy Quái',ico:'⛰️',heroes:['sontinh','thuytinh'],scope:'members',desc:'Kỳ phùng địch thủ huyền sử núi Tản Viên và biển sâu. Cả 2 tăng 25% Sức mạnh kỹ năng, Thủy Tinh thêm 15% Hút máu, Sơn Tinh thêm 30 Giáp.',fx:{spell:.25,armor:30,ls:.15}},
  {id:'chudongtu_tiendung',name:'Dạ Trạch Kỳ Duyên',ico:'🌸',heroes:['chudongtu','tiendung'],scope:'members',desc:'Mối duyên kỳ ngộ bãi cát Dạ Trạch, lập nên đầm Nhất Dạ cứu thế. Cả 2 tăng 20% Hút máu và 15% Máu tối đa.',fx:{ls:.2,hp:.15}},
  {id:'laclongquan_auco',name:'Bách Noãn Khai Thiên',ico:'🐉',heroes:['laclongquan','aucơ'],scope:'team',desc:'Quốc Tổ Lạc Long Quân và Quốc Mẫu Âu Cơ sinh bọc trăm trứng Rồng Tiên. Toàn đội tăng 12% Máu tối đa và 15 Giáp; Lạc Long Quân nhận sẵn 40 Nộ và 20% Sức mạnh kỹ năng; Âu Cơ tăng 25% Máu và 25 Giáp.',fx:{hp:.12,armor:15},teamFx:{hp:.12,armor:15},heroFx:{laclongquan:{mana:40,spell:.2},'aucơ':{hp:.25,armor:25},'auco':{hp:.25,armor:25}}},
  {id:'tranhungdao_giatuong',name:'Vương Gia Gia Tướng',ico:'🎖️',heroes:['tranhungdao','yetkieu','datuong'],scope:'members',desc:'Hưng Đạo Đại Vương cùng đôi gia tướng cận vệ vào sinh ra tử. Cả 3 nhận thêm 20% Máu, 25 Giáp và 15% Sát thương.',fx:{hp:.2,armor:25,ad:.15}},
  {id:'tranquangdieu_buithixuan',name:'Uyên Ương Trận Tuyến',ico:'⚔️',heroes:['tranquangdieu','buithixuan'],scope:'members',desc:'Cặp vợ chồng Đô đốc tiết liệt lừng danh Tây Sơn vào sinh ra tử. Cả 2 tăng 18% Sát thương, 20% Tốc đánh và 10% Hút máu.',fx:{ad:.18,as:.2,ls:.1}},
  {id:'anduongvuong_kimquy',name:'Loa Thành Thần Quy',ico:'🏯',heroes:['anduongvuong','kimquy'],scope:'members',desc:'Thần Kim Quy hiện lên giúp An Dương Vương xây thành Cổ Loa trừ yêu quái. An Dương Vương tăng 25% Máu và 30 Giáp; Kim Quy nhận 30 Nộ khởi đầu.',fx:{hp:.25,armor:30,mana:30}},
  {id:'tranhungdao_phamngulao',name:'Đan Sọt Đắc Tướng',ico:'🧺',heroes:['tranhungdao','phamngulao'],scope:'members',desc:'Trần Hưng Đạo phát hiện tài năng Phạm Ngũ Lão đan sọt bên đường, gả con gái và rèn giũa thành đại tướng. Phạm Ngũ Lão tăng 25% Sát thương và 20% Tốc đánh; Trần Hưng Đạo nhận 25 Nộ khởi đầu.',fx:{ad:.25,as:.2,mana:25}},
  {id:'yetkieu_datuong',name:'Tả Hữu Hộ Vệ',ico:'🛡️',heroes:['yetkieu','datuong'],scope:'members',desc:'Đôi bạn gia tướng thân tín của Hưng Đạo Vương: một đục thuyền giặc, một quản voi chiến. Yết Kiêu tăng 25% Chí mạng và 20% Tốc đánh; Dã Tượng tăng 30% Máu và 30 Giáp.',fx:{crit:.25,as:.2,hp:.3,armor:30}},
  {id:'leloi_kimquy',name:'Thuận Thiên Hoàn Kiếm',ico:'🗡️',heroes:['leloi','kimquy'],scope:'members',desc:'Huyền tích Hồ Gươm: Thần Kim Quy trao gươm Thuận Thiên giúp Lê Lợi cứu quốc rồi nhận lại gươm thiêng. Lê Lợi tăng 20% Sát thương và 15% Hút máu; Kim Quy tăng 25% Máu tối đa.',fx:{ad:.2,ls:.15,hp:.25}},
  {id:'caolo_kimquy',name:'Kim Trảo Thần Nỗ',ico:'🏹',heroes:['caolo','kimquy'],scope:'members',desc:'Thần Kim Quy rút móng trao tặng, Cao Lỗ dựa vào móng thần chế tạo nỏ Liên Châu hộ quốc. Cao Lỗ tăng 25% Tốc đánh và 20% Sát thương; Kim Quy tăng 20 Giáp.',fx:{as:.25,ad:.2,armor:20}}
];
function activeBonds(list){if(!list||!list.length)return [];const heroIds=new Set(list.map(u=>u.h));if(heroIds.has('aucơ'))heroIds.add('auco');if(heroIds.has('auco'))heroIds.add('aucơ');return BONDS.filter(b=>b.heroes.every(h=>heroIds.has(h)));}
function heroBonds(hid){const alt=hid==='aucơ'?'auco':(hid==='auco'?'aucơ':hid);return BONDS.filter(b=>b.heroes.includes(hid)||b.heroes.includes(alt));}

/* ===== 30 tướng và kỹ năng =====
   d,heal,sh: số = nhân SKM (1/1,7/2,8); mảng = giá trị riêng ★1/★2/★3
   v = mã hiệu ứng hình ảnh */
const HEROES_RAW=[
['chudongtu','Chử Đồng Tử','🎣','hongbang','thuatsi',1,{nm:'Ngư Võng Đoạt Nộ',t:'none',v:'luoi',mana:50,steal:{n:2,pct:.65,dur:4,dmgRed:[.25,.35,.5]}}],
['caolo','Cao Lỗ','🏹','aulac','cungno',1,{nm:'Thần Nỏ Liên Châu',t:'volley',v:'lienchau',k:[3,4,5],d:85,mana:60}],
['maithucloan','Mai Thúc Loan','🛡️','khoinghia','hove',1,{nm:'Hắc Đế Hộ Thân',t:'none',v:'hacde',sh:260,al:'self',dur:5,mana:50}],
['yetkieu','Yết Kiêu','🐟','lytran','dukich',1,{nm:'Kình Ngư Phá Hạm',t:'none',v:'lan',mana:50,hide:1.5,emerge:{d:260,shred:[15,25,40],shredT:4}}],
['lelai','Lê Lai','🥋','lamson','hove',1,{nm:'Hoán Bào Cứu Chúa',t:'none',v:'hoanbao',mana:60,taunt:{r:2.5,t:3},tarm:[40,70,110],sh:150,al:'self',dur:6}],
['nguyenxi','Nguyễn Xí','🎯','lamson','cungno',1,{nm:'Xích Huyết Xuyên Giáp',t:'nuke',v:'xichhuyet',d:280,mana:70}],
['datuong','Dã Tượng','🐘','lytran','chienbinh',1,{nm:'Cự Tượng Đạp Trận',t:'aoe',v:'cutuong',d:140,r:1.5,cen:'tgt',stun:[1,1.2,1.5],mana:60}],
['tiendung','Tiên Dung','🌸','hongbang','thuatsi',2,{nm:'Liên Hoa Dũ Thương',t:'none',v:'lienhoa',heal:120,al:'all',mana:80}],
['lyongtrong','Lý Ông Trọng','🗿','aulac','hove',2,{nm:'Đồng Tượng Trấn Ải',t:'aoe',v:'ongtrong',d:120,r:1.5,cen:'self',stun:[.8,1,1.2],sh:200,al:'self',dur:5,mana:70,grow:{ad:[.25,.35,.5],arm:[30,50,80],dur:[5,6,7]}}],
['trungnhi','Trưng Nhị','🌺','khoinghia','dukich',2,{nm:'Tuyệt Ảnh Trảm Tướng',t:'dash',v:'tuyetanh',d:340,tg:'low',mana:60}],
['phunghung','Phùng Hưng','🔨','khoinghia','hove',2,{nm:'Bố Cái Hộ Thể',t:'none',v:'bocai',sh:200,ad:[.4,.5,.65],al:'self',dur:5,mana:60}],
['tranquoctoan','Trần Quốc Toản','🍊','lytran','dukich',2,{nm:'Phá Nghịch Toái Khí',t:'dash',v:'toaikhi',d:300,stun:[1,1.2,1.5],mana:60}],
['phamngulao','Phạm Ngũ Lão','🔱','lytran','cungno',2,{nm:'Đông A Liệt Tiễn',t:'volley',v:'donga',k:[4,5,6],d:100,mana:70}],
['tranquangdieu','Trần Quang Diệu','🚩','tayson','cungno',2,{nm:'Xích Hỏa Liệt Tiễn',t:'nuke',v:'xichhoa',d:380,mana:70}],
['batrieu','Bà Triệu','👸','khoinghia','dukich',2,{nm:'Bạch Tượng Đạp Sóng',t:'dash',v:'voi',d:240,r:1.5,tg:'far',mana:70}],
['thuytinh','Thủy Tinh','🌊','hongbang','thuatsi',3,{nm:'Nộ Đào Cuồng Lan',t:'aoe',v:'lu',d:150,r:1.5,cen:'tgt',mana:90,zone:{kind:'flood',r:1.5,dur:6,dps:[60,100,170],slow:.3,delay:.6,cen:'tgt'}}],
['aucơ','Âu Cơ','🦢','hongbang','hove',3,{nm:'Trứng Tiên',t:'none',v:'trungtien',mana:90,egg:{hpPct:[.45,.5,.55],hatch:2.5,reviveHp:[.6,.8,1],reviveMana:.5,knock:1,reHeal:[.3,.4,.5]}}],
['anduongvuong','An Dương Vương','🏯','aulac','chienbinh',3,{nm:'Loa Thành Thiết Bích',t:'none',v:'khiendong',sh:[250,430,700],al:'self',dur:6,mana:90,burst:{d:[200,340,560],r:2}}],
['kimquy','Kim Quy','🐢','aulac','hove',3,{nm:'Thần Quy Linh Giáp',t:'aoe',v:'kim',d:200,r:2.5,cen:'self',stun:[1.2,1.8,2.5],sh:300,al:'self',dur:5,mana:90}],
['lythuongkiet','Lý Thường Kiệt','📜','lytran','thuatsi',3,{nm:'Nam Quốc Sơn Hà',t:'aoe',v:'chu',d:290,r:2.5,cen:'tgt',stun:[1,1.2,1.5],mana:90}],
['nguyentrai','Nguyễn Trãi','✒️','lamson','thuatsi',3,{nm:'Bình Ngô Mưu Lược',t:'none',v:'but',as:[.45,.55,.7],heal:80,al:'all',dur:6,mana:80}],
['buithixuan','Bùi Thị Xuân','⚔️','tayson','cungno',3,{nm:'Phi Tiễn Xuyên Tâm',t:'nuke',v:'phitien',d:540,mana:100}],
['sontinh','Sơn Tinh','⛰️','hongbang','hove',4,{nm:'Tản Viên Trấn Áp',t:'aoe',v:'nui',d:350,r:2,cen:'tgt',press:[1.5,2,2.5],sh:500,al:'self',dur:6,mana:100}],
['thanhgiong','Thánh Gióng','🐎','hongbang','chienbinh',4,{nm:'Thiết Mã Liệt Diễm',t:'dash',v:'ngua',d:560,r:1.5,tg:'far',ph:true,mana:90,trail:{dps:[60,100,170],dur:[3,4,5]}}],
['leloi','Lê Lợi','👑','lamson','chienbinh',4,{nm:'Thuận Thiên Khai Quốc',t:'aoe',v:'guom',d:400,r:2,cen:'tgt',ad:.3,al:'all',dur:6,mana:100,exec:.25}],
['trungtrac','Trưng Trắc','🎌','khoinghia','chienbinh',4,{nm:'Hát Môn Thệ Sư',t:'aoe',v:'co',d:380,r:2.5,cen:'self',as:[.35,.45,.6],al:'all',dur:6,mana:100}],
['ngoquyen','Ngô Quyền','⚓','khoinghia','cungno',4,{nm:'Bạch Đằng Trận Địa',t:'none',v:'coc',mana:100,zone:{kind:'stakes',r:2,dur:8,d:[220,370,620],slow:.3,delay:.4,cen:'tgt'}}],
['laclongquan','Lạc Long Quân','🐉','hongbang','thuatsi',5,{nm:'Long Triều Triệu Tướng',t:'aoe',v:'rong',d:450,r:3,cen:'tgt',sm:[2,3,4],mana:120}],
['tranhungdao','Trần Hưng Đạo','🎖️','lytran','chienbinh',5,{nm:'Sát Thát Hịch Tướng',t:'none',v:'hich',mana:120,pull:{n:[1,2,3],d:300},ad:.3,al:'all',dur:6}],
['nguyenhue','Nguyễn Huệ','🔥','tayson','dukich',5,{nm:'Thần Tốc Phá Địch',t:'dash',v:'thantoc',d:760,r:2,tg:'far',stun:[.8,1,1.2],as:.5,al:'self',dur:6,mana:100}]
];
const HERO={},BYCOST=[[],[],[],[],[],[]];
for(const [id,name,ico,o,c,cost,sk] of HEROES_RAW){HERO[id]={id,name,ico,o,c,cost,sk};BYCOST[cost].push(id);}
if(HERO['aucơ'])HERO['auco']=HERO['aucơ'];
HERO['rongcon']={id:'rongcon',name:'Kim Long',ico:'',o:'hongbang',c:'thuatsi',cost:1,sk:{nm:'Long Hỏa',t:'none',mana:0}};
const ALN={self:'bản thân',all:'cả đội',low:'đồng minh yếu nhất',near:'đồng minh xung quanh'};
function skillText(sk,star){
  const f=v=>Math.round(sc(v,star)),g=v=>sv(v,star),a=[],who=ALN[sk.al||'self'],pc=v=>Math.round(g(v)*100);
  if(sk.hide)a.push('Lặn xuống '+sk.hide+' giây (không bị chọn làm mục tiêu), rồi nhô lên đâm kẻ địch yếu máu nhất gây '+f(sk.emerge.d)+' sát thương và giảm '+g(sk.emerge.shred)+' giáp trong '+sk.emerge.shredT+' giây');
  if(sk.steal)a.push('Quăng lưới thần vào '+sk.steal.n+' kẻ địch nhiều nộ nhất, cướp '+Math.round(sk.steal.pct*100)+'% nộ chia đều cho toàn bộ đồng minh trên sân; đồng thời làm giảm '+pc(sk.steal.dmgRed)+'% sát thương gây ra của các mục tiêu đó trong '+sk.steal.dur+' giây');
  if(sk.taunt)a.push('Gầm thét: kẻ địch trong '+sk.taunt.r+' ô buộc đánh mình '+sk.taunt.t+' giây; +'+g(sk.tarm)+' giáp trong '+sk.dur+' giây');
  if(sk.d){
    if(sk.t==='nuke')a.push('Gây '+f(sk.d)+' sát thương lên mục tiêu');
    else if(sk.t==='volley')a.push('Bắn '+g(sk.k)+' mũi tên, mỗi mũi '+f(sk.d)+' sát thương vào kẻ địch ngẫu nhiên');
    else if(sk.t==='dash')a.push('Lao vào '+(sk.tg==='low'?'kẻ địch yếu máu nhất':sk.tg==='far'?'kẻ địch xa nhất':'mục tiêu')+', gây '+f(sk.d)+(sk.ph?' sát thương vật lý':' sát thương')+(sk.r?' trong '+sk.r+' ô':''));
    else if(sk.t==='aoe')a.push('Gây '+f(sk.d)+' sát thương trong '+sk.r+' ô');
  }
  if(sk.stun)a.push('làm choáng '+g(sk.stun)+' giây');
  if(sk.press)a.push('núi đè khóa hoàn toàn '+g(sk.press)+' giây (không hành động, không nạp nộ; boss miễn nhiễm)');
  if(sk.sm)a.push('gọi '+g(sk.sm)+' Kim Long phân thân uốn lượn hỗ chiến (tồn tại 8 giây, không tính vào số tướng)');
  if(sk.zone){const z=sk.zone;a.push(z.kind==='flood'?'tạo vùng lũ '+(z.r*2)+' ô trong '+z.dur+' giây: '+f(z.dps)+' sát thương mỗi giây, chậm '+Math.round(z.slow*100)+'% (boss chậm một nửa)':'cắm cọc '+(z.r*2)+' ô trong '+z.dur+' giây: địch bước vào bị đâm '+f(z.d)+' sát thương một lần và chậm '+Math.round(z.slow*100)+'%');}
  if(sk.trail)a.push('để lại vệt lửa '+g(sk.trail.dur)+' giây, '+f(sk.trail.dps)+' sát thương mỗi giây (không cộng dồn)');
  if(sk.pull)a.push('kéo '+g(sk.pull.n)+' kẻ địch xa nhất về phía mình, gây '+f(sk.pull.d)+' sát thương (boss miễn nhiễm)');
  if(sk.exec)a.push('kẻ địch dưới '+Math.round(sk.exec*100)+'% máu bị kết liễu (boss miễn nhiễm)');
  if(sk.grow)a.push('phóng to '+g(sk.grow.dur)+' giây: +'+pc(sk.grow.ad)+'% sát thương, +'+g(sk.grow.arm)+' giáp');
  if(sk.heal)a.push('hồi '+f(sk.heal)+' máu cho '+who);
  if(sk.sh&&!sk.taunt)a.push('tạo khiên '+f(sk.sh)+' cho '+who);
  else if(sk.sh&&sk.taunt)a.push('khiên '+f(sk.sh));
  if(sk.burst)a.push('khiên vỡ do bị đánh thì nổ '+f(sk.burst.d)+' sát thương trong '+sk.burst.r+' ô');
  if(sk.egg)a.push('đặt ấn Trứng Tiên lên đồng minh thấp máu nhất (chỉ 1 ấn, đến khi tướng đó chết; xuất chiêu lại thì chuyển ấn, hoặc hồi '+pc(sk.egg.reHeal)+'% máu nếu vẫn là người đó). Tướng mang ấn nhận sát thương kết liễu sẽ hóa trứng với '+pc(sk.egg.hpPct)+'% máu, ấp '+sk.egg.hatch+' giây: trứng vỡ thì chết hẳn, sống sót thì tái sinh '+pc(sk.egg.reviveHp)+'% máu, 50% nộ, đẩy lùi địch 1 ô');
  if(sk.ad&&!sk.grow)a.push('+'+pc(sk.ad)+'% sát thương trong '+sk.dur+' giây cho '+who);
  if(sk.as)a.push('+'+pc(sk.as)+'% tốc đánh trong '+(sk.dur||6)+' giây cho '+who);
  const s=a.join('; ');return s.charAt(0).toUpperCase()+s.slice(1)+'.';
}
function heroStats(hid,star){
  const H=HERO[hid],cs=CS[H.c];
  return {hp:Math.round(HPC[H.cost-1]*cs.hp*Math.pow(1.8,star-1)),ad:Math.round(ADC[H.cost-1]*cs.ad*Math.pow(1.5,star-1)),armor:cs.armor,range:cs.range,as:cs.as};
}
const RELICS=[
  {id:'trongdong',name:'Trống Đồng Đông Sơn',ico:'🥁',desc:'Cả đội +12% máu và +10 giáp.',fx:{hp:.12,armor:10}},
  {id:'guomthan',name:'Gươm Thần',ico:'🗡️',desc:'Cả đội +12% sát thương.',fx:{ad:.12}},
  {id:'nothan',name:'Nỏ Thần',ico:'🏹',desc:'Cả đội +15% tốc đánh.',fx:{as:.15}},
  {id:'non',name:'Nón Chử Đồng Tử',ico:'👒',desc:'Cả đội +25% sức mạnh kỹ năng.',fx:{spell:.25}},
  {id:'giap',name:'Áo Giáp Sắt Thánh Gióng',ico:'🛡️',desc:'Cả đội +25 giáp.',fx:{armor:25}},
  {id:'banh',name:'Bánh Chưng, Bánh Giầy',ico:'🍙',desc:'Cả đội +8% máu và +8% sát thương.',fx:{hp:.08,ad:.08}},
  {id:'hogom',name:'Hồ Gươm',ico:'🐢',desc:'Cả đội hút 8% máu.',fx:{ls:.08}},
  {id:'trau',name:'Trầu Cau',ico:'🌿',desc:'Nhận ngay 10 vàng.',fx:{},gold:10},
  {id:'ngoc',name:'Ngọc Như Ý',ico:'💎',desc:'Cả đội vào trận với 20 nộ.',fx:{mana:20}}
];
function relicFx(P){const f={};for(const id of P.relics){const r=RELICS.find(x=>x.id===id);for(const k in r.fx)f[k]=(f[k]||0)+r.fx[k];}return f;}

/* --- kho tướng chung --- */
const POOL_BY_COST={1:45,2:40,3:35,4:23,5:18};
function poolInit(){const pool={};for(const id in HERO)pool[id]=POOL_BY_COST[HERO[id].cost];return pool;}
function poolCount(G,hid){return (G.pool&&G.pool[hid])||0;}
function poolTake(G,hid){if(!G.pool||!G.pool[hid])return false;G.pool[hid]--;return true;}
function poolReturn(G,hid,n){if(!G.pool)return;const max=POOL_BY_COST[HERO[hid].cost];G.pool[hid]=Math.min(max,(G.pool[hid]||0)+n);}
function copiesOf(u){return Math.pow(3,u.s-1);}

/* --- đội hình & thuộc tính --- */
function traitCounts(list){
  const sets={};
  for(const u of list){const H=HERO[u.h];for(const t of [H.o,H.c]){(sets[t]=sets[t]||new Set()).add(u.h);}}
  const c={};for(const k in sets)c[k]=sets[k].size;return c;
}
function tierOf(t,n){let idx=-1;TR[t].tiers.forEach((x,i)=>{if(n>=x.n)idx=i;});return idx;}
function boardList(P){return P.board.filter(Boolean);}
function boardCount(P){return P.board.reduce((a,u)=>a+(u?1:0),0);}
function bareUnit(o){return Object.assign({alive:true,acd:0,mcd:0,stun:0,press:0,hide:0,imm:0,mslow:0,slow:null,forced:null,tarm:[],pend:[],burst:null,life:0,revived:false,sm:false,boss:false,sh:0,shT:0,bf:[],tgt:null,mana:0,maxMana:0,sk:null,crit:0,spell:0,ls:0,star:1,cost:1,cls:'mon',col:'#c4382c',egg:null,eggMark:null},o);}
function mkBU(u,side,x,y,counts,rfx,bonds){
  const H=HERO[u.h],cs=CS[H.c],s=u.s;
  let hp=HPC[H.cost-1]*cs.hp*Math.pow(1.8,s-1),ad=ADC[H.cost-1]*cs.ad*Math.pow(1.5,s-1);
  const f={hp:0,ad:0,as:0,armor:0,spell:0,crit:cs.crit,ls:0,mana:cs.mana0};
  const add=fx=>{if(!fx)return;for(const k in fx)f[k]=(f[k]||0)+fx[k];};
  for(const t in counts){const i=tierOf(t,counts[t]);if(i<0)continue;const T=TR[t];if(T.scope==='team'||H.o===t||H.c===t)add(T.tiers[i].fx);}
  add(rfx);
  if(bonds){
    for(const b of bonds){
      const isMember=b.heroes.includes(u.h)||(u.h==='aucơ'&&b.heroes.includes('auco'))||(u.h==='auco'&&b.heroes.includes('aucơ'));
      if(b.teamFx) add(b.teamFx);
      if(isMember&&b.heroFx){
        const hfx=b.heroFx[u.h]||(u.h==='aucơ'?b.heroFx['auco']:(u.h==='auco'?b.heroFx['aucơ']:null));
        if(hfx) add(hfx);
      }
      if(b.fx&&!b.teamFx&&!b.heroFx){if(b.scope==='team'||isMember) add(b.fx);}
    }
  }
  hp=Math.round(hp*(1+f.hp));ad*=1+f.ad;
  return bareUnit({id:UID++,side,x,y,h:u.h,star:s,name:H.name,ico:H.ico,cost:H.cost,cls:H.c,org:H.o,col:TR[H.o].col,max:hp,hp,ad,armor:cs.armor+f.armor,as:cs.as*(1+f.as),range:cs.range,crit:f.crit,spell:f.spell,ls:f.ls,sk:H.sk,maxMana:H.sk.mana,mana:Math.min(f.mana,Math.floor(H.sk.mana*.6))});
}
function boardToUnits(P,side){
  const bl=boardList(P),counts=traitCounts(bl),rfx=relicFx(P),bonds=activeBonds(bl),out=[];
  P.board.forEach((u,i)=>{if(!u)return;const r=Math.floor(i/4),c=i%4;out.push(mkBU(u,side,side===0?c:W-1-c,r,counts,rfx,bonds));});
  return out;
}
function mon(nm,ico,hp,ad,armor,range,as,x,y,sk){return bareUnit({id:UID++,side:1,x,y,name:nm,ico,max:hp,hp,ad,armor,as,range,sk:sk||null,maxMana:sk?sk.mana:0,mon:true,cost:1});}
function pveUnits(r){
  const boss={nm:'Yêu Pháp',t:'aoe',v:'burst',d:240,r:2.5,cen:'self',stun:1,mana:60};
  const arr=(()=>{switch(r){
    case 1:return [mon('Hồ Quái','🦊',330,26,10,1,.7,5,2),mon('Hồ Quái','🦊',330,26,10,1,.7,5,4)];
    case 2:return [mon('Hồ Quái','🦊',380,32,10,1,.7,5,1),mon('Hồ Quái','🦊',380,32,10,1,.7,5,3),mon('Hồ Quái','🦊',380,32,10,1,.7,5,5)];
    case 3:return [mon('Mộc Quái','🌳',460,36,20,1,.7,5,1),mon('Mộc Quái','🌳',460,36,20,1,.7,5,5),mon('Mộc Quái','🌳',460,36,20,1,.7,5,3),mon('Ngư Quái','🦑',330,40,5,3,.7,7,3)];
    case 8:return [mon('Hồ Tinh','🦊',4600,75,35,3,.75,6,3,Object.assign({},boss,{nm:'Yêu Pháp',cen:'tgt',d:260,r:2})),mon('Hồ Quái','🦊',650,45,15,1,.7,4,2),mon('Hồ Quái','🦊',650,45,15,1,.7,4,4)];
    case 15:return [mon('Ngư Tinh','🐙',9000,110,50,3,.65,4,3,boss),mon('Ngư Quái','🦑',900,60,10,3,.7,6,1),mon('Ngư Quái','🦑',900,60,10,3,.7,6,5),mon('Ngư Quái','🦑',900,60,15,3,.7,5,2),mon('Ngư Quái','🦑',900,60,15,3,.7,5,4)];
    default:return [mon('Mộc Tinh','🌲',16000,160,70,1,.65,4,3,Object.assign({},boss,{d:400,r:3})),mon('Mộc Quái','🌳',1500,90,30,1,.7,4,1),mon('Mộc Quái','🌳',1500,90,30,1,.7,4,5),mon('Mộc Quái','🌳',1500,90,30,1,.7,5,2),mon('Mộc Quái','🌳',1500,90,30,1,.7,5,4)];
  }})();
  if(r===8||r===15||r===22)arr[0].boss=true;
  return arr;
}
const PVE_NAME={1:'Hồ Quái',2:'Hồ Quái',3:'Mộc Quái, Ngư Quái',8:'Boss Hồ Tinh',15:'Boss Ngư Tinh',22:'Boss Mộc Tinh'};
function pveName(r){const k=Object.keys(PVE_NAME).map(Number).filter(x=>x<=r).pop();return PVE_NAME[k]||'Yêu quái';}

/* ===== ENGINE TRẬN ĐÁNH (không đụng tới giao diện) ===== */
const DIRS=[[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
function em(B,e){if(B.ev)B.ev.push(e);}
const d2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const cheb=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
const alv=(B,side)=>B.units.filter(u=>u.alive&&u.side===side);
function newBattle(units,withEvents){
  const B={units,t:0,over:false,winner:1,surv:0,occ:new Array(W*HH).fill(null),ev:withEvents?[]:null,zones:[],zid:1,byId:{}};
  for(const u of units){B.occ[u.y*W+u.x]=u;B.byId[u.id]=u;u.dmgDealt=0;u.dmgTaken=0;}
  for(const u of units){
    if(u.cls!=='dukich')continue;
    const foes=units.filter(f=>f.side!==u.side);if(!foes.length)continue;
    let far=foes[0];for(const f of foes)if(d2(u,f)>d2(u,far))far=f;
    jumpAdj(B,u,far,true);u.tgt=far;
  }
  return B;
}
function nearestOf(list,u){let b=null,bd=1e9;for(const f of list){const d=d2(u,f);if(d<bd){bd=d;b=f;}}return b;}
function nearest(B,u){let b=null,bd=1e9;for(const f of B.units){if(!f.alive||f.side===u.side||f.hide>0)continue;const d=d2(u,f);if(d<bd){bd=d;b=f;}}return b;}
function adMul(u){let s=1;for(const b of u.bf)s+=b.ad||0;return s;}
function asMul(u){let s=1;for(const b of u.bf)s+=b.as||0;if(u.slow)s-=u.slow.pct*.5;return Math.max(.3,s);}
function armorOf(u){let a=u.armor;for(const b of u.bf)a+=b.arm||0;for(const b of u.tarm)a+=b.v;return Math.max(-50,a);}
function gainMana(u,v){if(!u.maxMana||u.press>0||!u.alive)return;if(u.mslow>0)v*=.5;u.mana=Math.min(u.maxMana,u.mana+v);}
function applySlow(f,pct,t){if(f.boss)pct*=.5;f.slow={pct:Math.max(pct,f.slow?f.slow.pct:0),t:Math.max(t,f.slow?f.slow.t:0)};}
function freeAdj(B,u){
  for(let r=1;r<=2;r++){
    let best=null,bs=1e9;
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
      const nx=u.x+dx,ny=u.y+dy;if(nx<0||ny<0||nx>=W||ny>=HH||B.occ[ny*W+nx])continue;
      const sc2=(u.side===0?nx:-nx)+Math.abs(dy)*.1;if(sc2<bs){bs=sc2;best=[nx,ny];}
    }
    if(best)return best;
  }
  return null;
}
function jumpAdj(B,u,d,behind){
  let best=null,bs=1e9;
  for(const [dx,dy] of DIRS){
    const nx=d.x+dx,ny=d.y+dy;if(nx<0||ny<0||nx>=W||ny>=HH||B.occ[ny*W+nx])continue;
    const sc2=behind?(u.side===0?-nx:nx)*10+Math.abs(ny-d.y):d2({x:nx,y:ny},u);
    if(sc2<bs){bs=sc2;best=[nx,ny];}
  }
  if(best){B.occ[u.y*W+u.x]=null;u.x=best[0];u.y=best[1];B.occ[u.y*W+u.x]=u;em(B,{k:'jump',id:u.id});}
}
function healRaw(B,u,v){if(!u.alive)return;const h=Math.min(u.max-u.hp,v);if(h<=0)return;u.hp+=h;em(B,{k:'dmg',id:u.id,v:Math.round(h),type:'heal'});}
function giveShield(u,v,dur){u.sh+=v;u.shT=Math.max(u.shT,dur);}
function killUnit(B,u,noRevive){
  if(!u.alive)return;
  if(!noRevive&&u.eggMark&&!u.sm&&!u.mon&&!u.egg&&!B.over){
    const E=HERO['aucơ'].sk.egg,s=u.eggMark.star;
    const eggHp=Math.max(1,Math.round(u.max*sv(E.hpPct,s)));
    u.eggMark=null;
    u.egg={t:E.hatch,star:s,maxHp:eggHp};
    u.hp=eggHp;
    u.stun=Math.max(u.stun,E.hatch);u.imm=0;u.press=0;u.sh=0;u.burst=null;
    em(B,{k:'egg',id:u.id});return;
  }
  u.hp=0;u.alive=false;B.occ[u.y*W+u.x]=null;em(B,{k:'die',id:u.id});
}
function knockback(B,src,dst){
  const dx=Math.sign(dst.x-src.x),dy=Math.sign(dst.y-src.y);
  let nx=dst.x,ny=dst.y;
  if(Math.abs(dst.x-src.x)>=Math.abs(dst.y-src.y))nx=dst.x+dx;else ny=dst.y+dy;
  if(nx<0||ny<0||nx>=W||ny>=HH||B.occ[ny*W+nx])return;
  B.occ[dst.y*W+dst.x]=null;dst.x=nx;dst.y=ny;B.occ[dst.y*W+dst.x]=dst;
  em(B,{k:'knock',id:dst.id});
}
function hatchEgg(B,u){
  const E=HERO['aucơ'].sk.egg,s=u.egg.star;
  u.egg=null;u.stun=0;u.press=0;
  u.hp=Math.max(1,Math.round(u.max*sv(E.reviveHp,s)));
  u.mana=u.maxMana?Math.round(u.maxMana*E.reviveMana):0;
  u.imm=.5;
  for(const f of alv(B,1-u.side))if(!f.boss&&Math.hypot(f.x-u.x,f.y-u.y)<=E.knock+.01)knockback(B,u,f);
  em(B,{k:'hatch',id:u.id});
}
function explodeBurst(B,u){
  const b=u.burst;u.burst=null;if(!b)return;
  em(B,{k:'burst',id:u.id,x:u.x,y:u.y,r:b.r,hero:u.h});
  for(const f of alv(B,1-u.side))if(Math.hypot(f.x-u.x,f.y-u.y)<=b.r+.01)dealDamage(B,u,f,b.d,'mag',false,{noBurst:true});
}
function dealDamage(B,src,dst,amt,type,crit,opts){
  if(!dst.alive)return;
  opts=opts||{};
  if(dst.imm>0&&!opts.pierce)return;
  if(src&&src.dmgRed&&src.dmgRed.t>0)amt*=Math.max(0.1, 1 - src.dmgRed.pct);
  let d=type==='phys'?amt*100/(100+armorOf(dst)):amt;
  const total=d,hadSh=dst.sh>0;
  if(!opts.ignoreShield&&dst.sh>0){const ab=Math.min(dst.sh,d);dst.sh-=ab;d-=ab;}
  dst.hp-=d;
  if(src)src.dmgDealt=(src.dmgDealt||0)+total;
  dst.dmgTaken=(dst.dmgTaken||0)+total;
  if(src&&src.ls&&total>0)healRaw(B,src,total*src.ls);
  if(!opts.noMana)gainMana(dst,8);
  if(!opts.silent)em(B,{k:'dmg',id:dst.id,v:Math.round(total),crit:!!crit,type});
  if(hadSh&&dst.sh<=0&&dst.burst&&!opts.noBurst&&!opts.ignoreShield)explodeBurst(B,dst);
  if(dst.hp<=0)killUnit(B,dst,opts.pierce);
}
function needsRange(sk){return sk.t==='nuke'||(sk.t==='aoe'&&sk.cen==='tgt')||(sk.zone&&sk.zone.cen==='tgt');}
function attack(B,u,t){
  const crit=Math.random()<u.crit;
  u.acd=1/(u.as*asMul(u));
  gainMana(u,12);
  em(B,{k:'atk',id:u.id,tid:t.id,ranged:u.range>1});
  dealDamage(B,u,t,u.ad*adMul(u)*(crit?1.6:1),u.name==='Hồ Tinh'?'mag':'phys',crit);
}
function addZone(B,o){
  const z=Object.assign({id:B.zid++,arm:o.delay||0,t:o.dur,hit:new Set()},o);
  B.zones.push(z);
  em(B,{k:'zone',z:{id:z.id,kind:z.kind,x:z.x,y:z.y,r:z.r,dur:z.dur,delay:z.arm}});
  return z;
}
function stepZones(B,dt){
  for(const z of B.zones){
    if(z.dead)continue;
    if(z.arm>0){z.arm-=dt;if(z.arm>0)continue;em(B,{k:'zoneOn',id:z.id});}
    z.t-=dt;
    for(const f of alv(B,1-z.side)){
      if(Math.hypot(f.x-z.x,f.y-z.y)>z.r+.01)continue;
      if(z.slow)applySlow(f,z.slow,.4);
      if(z.kind==='stakes'){if(!z.hit.has(f.id)){z.hit.add(f.id);dealDamage(B,z.src,f,z.d,'mag');}}
      else{
        if(!f.zt)f.zt={};
        if(f.zt[z.kind]===undefined||B.t-f.zt[z.kind]>=1){f.zt[z.kind]=B.t;dealDamage(B,z.src,f,z.dps,'mag');}
      }
    }
    if(z.t<=0){z.dead=true;em(B,{k:'zoneEnd',id:z.id});}
  }
  if(B.zones.length>40)B.zones=B.zones.filter(z=>!z.dead);
}
function spawnSummon(B,u,n,s){
  const out=[];
  for(let i=0;i<n;i++){
    const cell=freeAdj(B,u);if(!cell)break;
    const hpv=Math.round(u.max*[.2,.24,.28][s-1]);
    const isLLQ=u.h==='laclongquan';const m=bareUnit({id:UID++,side:u.side,x:cell[0],y:cell[1],name:isLLQ?'Kim Long':'Lính nước',ico:isLLQ?'':u.ico,h:isLLQ?'rongcon':u.h,cls:'summon',sm:true,max:hpv,hp:hpv,ad:u.ad*.45,armor:15,as:.8,range:1,life:8,star:1,col:isLLQ?'#ffd36a':u.col});
    B.units.push(m);B.occ[m.y*W+m.x]=m;B.byId[m.id]=m;out.push(m);
    em(B,{k:'spawn',id:m.id,u:m});
  }
  return out;
}
function castSkill(B,u){
  const sk=u.sk,s=u.star,sp=1+u.spell;
  u.mana=0;u.acd=Math.max(u.acd,.6);
  const foesAll=alv(B,1-u.side),foes=foesAll.filter(f=>!(f.hide>0));
  let t=(u.tgt&&u.tgt.alive&&!(u.tgt.hide>0))?u.tgt:nearestOf(foes,u);
  em(B,{k:'cast',id:u.id,nm:sk.nm,s,cost:u.cost,h:u.h,col:u.col});
  const x0=u.x,y0=u.y;
  if(sk.hide){
    u.hide=sk.hide;u.stun=Math.max(u.stun,sk.hide);u.pend.push({t:sk.hide,f:'emerge'});
    em(B,{k:'fx',v:'lan',s,col:u.col,x0,y0,x1:x0,y1:y0,tx:x0,ty:y0,cx:x0,cy:y0,r:1});
    return;
  }
  if(sk.t==='dash'&&foes.length){
    let d=t;
    if(sk.tg==='low')d=foes.reduce((a,b)=>(!a||b.hp<a.hp)?b:a,null);
    else if(sk.tg==='far')d=foes.reduce((a,b)=>(!a||d2(u,b)>d2(u,a))?b:a,null);
    if(d){if(cheb(u,d)>1)jumpAdj(B,u,d,false);u.tgt=d;t=d;}
  }
  const tx=t?t.x:u.x,ty=t?t.y:u.y;
  let cx=tx,cy=ty;
  if(sk.egg){
    const eggAllies=alv(B,u.side).filter(a=>!a.sm&&!a.egg);
    const eggLow=eggAllies.reduce((a,b)=>(!a||b.hp/b.max<a.hp/a.max)?b:a,null);
    if(eggLow){cx=eggLow.x;cy=eggLow.y;}
  }
  const hits=[];
  if(sk.d&&foesAll.length){
    const dmg=sc(sk.d,s)*sp;
    if(sk.t==='nuke'||(sk.t==='dash'&&!sk.r)){if(t&&t.alive){hits.push(t);if(sk.t==='nuke'&&sk.v==='ten')em(B,{k:'shot',id:u.id,tid:t.id,col:u.col});}}
    else if(sk.t==='aoe'||sk.t==='dash'){
      const c=(sk.t==='aoe'&&sk.cen==='tgt'&&t)?t:u;cx=c.x;cy=c.y;
      for(const f of foesAll)if(Math.hypot(f.x-c.x,f.y-c.y)<=sk.r+.01)hits.push(f);
    }else if(sk.t==='volley'){
      const n=sv(sk.k,s);
      for(let i=0;i<n&&foes.length;i++){const f=pickOf(foes);hits.push(f);if(sk.v==='ten')em(B,{k:'shot',id:u.id,tid:f.id,col:u.col});}
    }
    const type=sk.ph?'phys':'mag';
    for(const f of hits){
      dealDamage(B,u,f,dmg,type,false);
      if(!f.alive)continue;
      if(sk.stun&&!f.boss){f.stun=Math.max(f.stun,sv(sk.stun,s));em(B,{k:'stun',id:f.id});}
      if(sk.press&&!f.boss){f.press=Math.max(f.press,sv(sk.press,s));em(B,{k:'press',id:f.id});}
    }
  }
  let stealTargets=null;
  if(sk.steal){
    const S=sk.steal;let got=0;
    const cand=foes.filter(f=>f.alive&&f.maxMana>0).sort((a,b)=>(b.mana-a.mana)||d2(u,a)-d2(u,b)).slice(0,S.n||2);
    const redPct=sv(S.dmgRed||[.25,.35,.5],s);
    const dur=S.dur||4;
    stealTargets=[];
    for(const f of cand){
      const pct=f.boss?Math.min(S.pct||.65,.35):(S.pct||.65);
      const amt=f.mana*pct;f.mana=Math.max(0,f.mana-amt);got+=amt;
      f.dmgRed={pct:redPct,t:dur};
      stealTargets.push({id:f.id,x:f.x,y:f.y});
      em(B,{k:'steal',id:f.id,from:u.id,amt,red:redPct,dur});
    }
    const allies=alv(B,u.side);
    if(allies.length&&got>0){
      const share=got/allies.length;
      for(const al of allies){
        gainMana(al,share);
        em(B,{k:'manaShare',id:al.id,from:u.id,amt:share});
      }
    }
  }
  em(B,{k:'fx',v:sk.v||'burst',s,col:u.col,x0,y0,x1:u.x,y1:u.y,tx,ty,cx,cy,r:sk.r||1.5,hero:u.h,id:u.id,targets:stealTargets,side:u.side});
  if(sk.exec){
    for(const f of hits)if(f.alive&&!f.boss&&f.hp<f.max*sk.exec){
      dealDamage(B,u,f,f.hp+1,'true',false,{ignoreShield:true,noMana:true,silent:true,pierce:true,noBurst:true});
      em(B,{k:'exec',id:f.id});
    }
  }
  if(sk.trail){
    const T=sk.trail,dur=sv(T.dur,s),dps=sc(T.dps,s);
    const n=Math.max(1,Math.min(8,Math.round(Math.hypot(u.x-x0,u.y-y0))));
    for(let i=0;i<=n;i++)addZone(B,{kind:'fire',x:x0+(u.x-x0)*i/n,y:y0+(u.y-y0)*i/n,r:.75,dur,dps,side:u.side,src:u,delay:0});
  }
  if(sk.zone){
    const Z=sk.zone,c=(Z.cen==='tgt'&&t)?t:u;
    addZone(B,{kind:Z.kind,x:c.x,y:c.y,r:Z.r,dur:Z.dur,dps:sc(Z.dps||0,s),d:sc(Z.d||0,s),slow:Z.slow,side:u.side,src:u,delay:Z.delay||0});
  }
  if(sk.sm)spawnSummon(B,u,sv(sk.sm,s),s);
  if(sk.pull){
    const P=sk.pull,n=sv(P.n,s);
    const cand=foes.filter(f=>!f.boss&&!f.sm).sort((a,b)=>d2(u,b)-d2(u,a)).slice(0,n);
    for(const f of cand){
      jumpAdj(B,f,u,false);em(B,{k:'pull',id:f.id,from:u.id});
      if(P.d)dealDamage(B,u,f,sc(P.d,s)*sp,'mag',false);
    }
  }
  if(sk.taunt){
    for(const f of foesAll)if(!f.boss&&Math.hypot(f.x-u.x,f.y-u.y)<=sk.taunt.r+.01){f.forced={id:u.id,t:sk.taunt.t};em(B,{k:'taunt',id:f.id});}
    u.tarm.push({v:sv(sk.tarm,s),t:sk.dur||6});
  }
  if(sk.grow){u.bf.push({ad:sv(sk.grow.ad,s),as:0,arm:sv(sk.grow.arm,s),grow:1,t:sv(sk.grow.dur,s)});em(B,{k:'grow',id:u.id});}
  if(sk.egg){
    const E=sk.egg;
    const allies=alv(B,u.side).filter(a=>!a.sm&&!a.egg);
    if(allies.length){
      const low=allies.reduce((a,b)=>(!a||b.hp/b.max<a.hp/a.max)?b:a,null);
      const cur=allies.find(a=>a.eggMark);
      if(cur&&cur!==low){cur.eggMark=null;low.eggMark={star:s};em(B,{k:'eggmark',id:low.id,from:u.id});}
      else if(cur&&cur===low){healRaw(B,low,low.max*sv(E.reHeal,s));em(B,{k:'eggheal',id:low.id,from:u.id});}
      else{low.eggMark={star:s};em(B,{k:'eggmark',id:low.id,from:u.id});}
    }
  }
  if(sk.burst){u.burst={d:sc(sk.burst.d,s),r:sk.burst.r};}
  const al=sk.al||((sk.heal||sk.sh||(sk.ad&&!sk.grow)||sk.as)?'self':null);
  if(al){
    const allies=alv(B,u.side).filter(a=>!a.sm||al==='self');let list;
    if(al==='all')list=allies;
    else if(al==='low')list=[allies.reduce((a,b)=>(!a||b.hp/b.max<a.hp/a.max)?b:a,null)];
    else if(al==='near')list=allies.filter(a=>Math.hypot(a.x-u.x,a.y-u.y)<=(sk.ar||1.5));
    else list=[u];
    for(const a of list){
      if(!a)continue;
      if(sk.heal)healRaw(B,a,sc(sk.heal,s)*sp);
      if(sk.sh){giveShield(a,sc(sk.sh,s)*sp,sk.dur||5);em(B,{k:'shield',id:a.id});}
      if(!sk.grow&&sk.ad||sk.as){a.bf.push({ad:sk.grow?0:(sv(sk.ad,s)||0),as:sv(sk.as,s)||0,t:sk.dur||6});em(B,{k:'buff',id:a.id});}
    }
  }
}
function runPend(B,u,p){
  if(p.f!=='emerge')return;
  const sk=u.sk,s=u.star,E=sk.emerge;
  u.hide=0;
  const foes=alv(B,1-u.side);if(!foes.length)return;
  const d=foes.reduce((a,b)=>(!a||b.hp<a.hp)?b:a,null);
  const x0=u.x,y0=u.y;
  if(cheb(u,d)>1)jumpAdj(B,u,d,false);
  u.tgt=d;
  dealDamage(B,u,d,sc(E.d,s)*(1+u.spell),'mag',false);
  if(d.alive)d.tarm.push({v:-sv(E.shred,s),t:E.shredT});
  em(B,{k:'fx',v:'emerge',s,col:u.col,x0,y0,x1:u.x,y1:u.y,tx:d.x,ty:d.y,cx:d.x,cy:d.y,r:1});
}
function moveToward(B,u,t){
  const start=u.y*W+u.x,prev=new Int16Array(W*HH).fill(-2);prev[start]=-1;const q=[start];let goal=-1;
  for(let qi=0;qi<q.length;qi++){
    const cur=q[qi],cx=cur%W,cy=(cur/W)|0;
    if(cur!==start&&Math.max(Math.abs(cx-t.x),Math.abs(cy-t.y))<=u.range){goal=cur;break;}
    for(const [dx,dy] of DIRS){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=W||ny>=HH)continue;const ni=ny*W+nx;if(prev[ni]!==-2||B.occ[ni])continue;prev[ni]=cur;q.push(ni);}
  }
  if(goal<0)return;
  let c=goal;while(prev[c]!==start)c=prev[c];
  B.occ[start]=null;u.x=c%W;u.y=(c/W)|0;B.occ[c]=u;
  u.mcd=MOVE_CD/Math.max(.3,1-(u.slow?u.slow.pct:0));
}
function act(B,u){
  let t=u.tgt;
  if(u.forced){const ft=B.byId[u.forced.id];if(ft&&ft.alive&&!(ft.hide>0))t=u.tgt=ft;}
  if(!t||!t.alive||t.hide>0)t=u.tgt=nearest(B,u);
  if(!t)return;
  let d=cheb(u,t);
  if(d>u.range&&!u.forced){const n=nearest(B,u);if(n&&cheb(u,n)<=u.range){u.tgt=n;t=n;d=cheb(u,n);}}
  const inR=d<=u.range,sk=u.sk;
  if(sk&&u.mana>=u.maxMana&&u.acd<=0&&(inR||!needsRange(sk))){castSkill(B,u);return;}
  if(u.demoHold)return;
  if(inR){if(u.acd<=0)attack(B,u,t);}
  else if(u.mcd<=0)moveToward(B,u,t);
}
function step(B,dt){
  if(B.over)return;
  B.t+=dt;
  if(B.t>30){const k=.006*(B.t-30)*dt;for(const u of B.units)if(u.alive)dealDamage(B,null,u,u.max*k,'true',false,{ignoreShield:true,noMana:true,silent:true,pierce:true,noBurst:true});}
  stepZones(B,dt);
  for(const u of B.units){
    if(!u.alive)continue;
    if(u.acd>0)u.acd-=dt;if(u.mcd>0)u.mcd-=dt;
    if(u.imm>0)u.imm-=dt;if(u.hide>0)u.hide-=dt;if(u.press>0)u.press-=dt;if(u.mslow>0)u.mslow-=dt;
    if(u.egg){u.egg.t-=dt;if(u.stun>0)u.stun-=dt;if(u.egg.t<=0)hatchEgg(B,u);continue;}
    if(u.slow){u.slow.t-=dt;if(u.slow.t<=0)u.slow=null;}
    if(u.dmgRed){u.dmgRed.t-=dt;if(u.dmgRed.t<=0)u.dmgRed=null;}
    if(u.forced){u.forced.t-=dt;if(u.forced.t<=0)u.forced=null;}
    if(u.tarm.length){for(const a of u.tarm)a.t-=dt;u.tarm=u.tarm.filter(a=>a.t>0);}
    if(u.shT>0){u.shT-=dt;if(u.shT<=0){u.sh=0;u.burst=null;}}
    if(u.bf.length){for(const b of u.bf)b.t-=dt;u.bf=u.bf.filter(b=>b.t>0);}
    if(u.life>0){u.life-=dt;if(u.life<=0){u.life=0;u.hp=0;u.alive=false;B.occ[u.y*W+u.x]=null;em(B,{k:'die',id:u.id});continue;}}
    gainMana(u,1.5*dt);
    if(u.pend.length){for(const p of u.pend)p.t-=dt;const due=u.pend.filter(p=>p.t<=0);u.pend=u.pend.filter(p=>p.t>0);for(const p of due)runPend(B,u,p);}
    if(u.stun>0||u.press>0){if(u.stun>0)u.stun-=dt;continue;}
    act(B,u);
  }
  let a0=0,a1=0;for(const u of B.units)if(u.alive&&!u.sm){if(u.side)a1++;else a0++;}
  if(a0===0||a1===0){
    B.over=true;
    if(a0===0&&a1===0){B.winner=null;B.surv=0;}else{B.winner=a0>0?0:1;B.surv=a0>0?a0:a1;}
    for(const u of B.units)if(u.alive&&u.sm){u.alive=false;B.occ[u.y*W+u.x]=null;em(B,{k:'die',id:u.id});}
  }else if(B.t>=70){
    B.over=true;let h0=0,h1=0;for(const u of B.units)if(u.alive&&!u.sm){if(u.side)h1+=u.hp;else h0+=u.hp;}
    if(h0===h1){B.winner=null;B.surv=0;}else{B.winner=h0>h1?0:1;B.surv=B.winner?a1:a0;}
  }
}
function runBattle(B){let n=0;while(!B.over&&n++<2000)step(B,TICK);return B;}

/* --- người chơi, cửa hàng, gộp sao --- */
function newPlayer(name,human,i,av){return {id:i,name,human,av,hp:100,gold:6,lvl:2,xp:0,bench:Array(9).fill(null),board:Array(28).fill(null),shop:[],streak:0,lastWin:false,alive:true,place:0,relics:[],fav:[],log:[]};}
function mkUnitObj(h,s){return {uid:UID++,h,s:s||1};}
function levelCheck(p){while(p.lvl<9&&p.xp>=XPN[p.lvl]){p.xp-=XPN[p.lvl];p.lvl++;}if(p.lvl>=9)p.xp=0;}
function rollShop(G,p){
  const od=ODDS[p.lvl],out=[];
  for(let i=0;i<5;i++){let r=rnd(100),c=0;while(c<4&&r>=od[c]){r-=od[c];c++;}out.push(pickFromPool(G,c+1));}
  return out;
}
function pickFromPool(G,cost){
  for(let d=0;d<5;d++){
    const costs=d===0?[cost]:[];
    if(d>0){if(cost+d<=5)costs.push(cost+d);if(cost-d>=1)costs.push(cost-d);}
    for(const cc of costs){
      const avail=BYCOST[cc].filter(h=>poolCount(G,h)>0);
      if(avail.length)return pickOf(avail);
    }
  }
  return null;
}
function mergeAll(P){
  let again=true;
  while(again){
    again=false;
    const locs=[];
    P.board.forEach((u,i)=>u&&locs.push({a:'board',i,u}));
    P.bench.forEach((u,i)=>u&&locs.push({a:'bench',i,u}));
    const groups={};
    for(const l of locs){const k=l.u.h+'|'+l.u.s;(groups[k]=groups[k]||[]).push(l);}
    for(const k in groups){
      const g=groups[k];
      if(g.length>=3&&g[0].u.s<3){
        g[0].u.s++;for(const r of g.slice(1,3))P[r.a][r.i]=null;
        P.log.push({h:g[0].u.h,s:g[0].u.s});again=true;break;
      }
    }
  }
}
function addUnit(P,u){
  const i=P.bench.indexOf(null);
  if(i>=0){P.bench[i]=u;mergeAll(P);return true;}
  P.bench.push(u);mergeAll(P);
  if(P.bench.length>9){if(P.bench[9]===null){P.bench.length=9;return true;}P.bench.pop();return false;}
  return true;
}
function canAdd(P,h){
  if(P.bench.indexOf(null)>=0)return true;
  const n=[...P.board,...P.bench].filter(u=>u&&u.h===h&&u.s===1).length;
  return n>=2;
}
function buyUnit(G,P,i){
  const h=P.shop[i];if(!h)return false;
  const cost=HERO[h].cost;if(P.gold<cost||!canAdd(P,h))return false;
  if(poolCount(G,h)<=0){P.shop[i]=null;return false;}
  if(!poolTake(G,h))return false;
  if(!addUnit(P,mkUnitObj(h,1))){poolReturn(G,h,1);return false;}
  P.gold-=cost;P.shop[i]=null;return true;
}
function sellValue(u){const c=HERO[u.h].cost;return u.s===1?c:c*Math.pow(3,u.s-1)-(c>1?1:0);}
function sellUnit(G,P,k,i){const u=P[k][i];if(!u)return 0;const v=sellValue(u);P.gold+=v;P[k][i]=null;poolReturn(G,u.h,copiesOf(u));return v;}
function moveUnit(P,f,t){
  if(f.k===t.k&&f.i===t.i)return false;
  const u=P[f.k][f.i];if(!u)return false;
  const v=P[t.k][t.i];
  if(t.k==='board'&&f.k==='bench'&&!v&&boardCount(P)>=P.lvl)return false;
  P[f.k][f.i]=v||null;P[t.k][t.i]=u;return true;
}
function buyXp(P){if(P.gold<4||P.lvl>=9)return false;P.gold-=4;P.xp+=4;levelCheck(P);return true;}
function reroll(G,P){if(P.gold<2)return false;P.gold-=2;P.shop=rollShop(G,P);return true;}
const MELEE=['hove','chienbinh','dukich'];
const MELEE_FORM_SLOTS=[
  [3,3],[2,3],[4,3],
  [1,2],[3,2],[5,2],[2,2],[4,2],
  [1,3],[5,3],
  [2,1],[4,1],[3,1],[1,1],[5,1],
  [0,3],[6,3],[0,2],[6,2],[0,1],[6,1],[0,0],[6,0]
];
const RANGED_FORM_SLOTS=[
  [3,0],[2,0],[4,0],[1,0],[5,0],
  [3,1],[2,1],[4,1],[1,1],[5,1],
  [1,2],[3,2],[5,2],[2,2],[4,2],
  [3,3],[2,3],[4,3],[1,3],[5,3],
  [0,0],[6,0],[0,1],[6,1],[0,2],[6,2],[0,3],[6,3]
];
function autoArrange(P){
  const all=[];P.board.forEach(u=>u&&all.push(u));P.bench.forEach(u=>u&&all.push(u));
  const cap=Math.min(P.lvl,all.length),chosen=[],pool=all.slice();
  while(chosen.length<cap){
    let bi=-1,bs=-1e9;
    pool.forEach((u,i)=>{
      const H=HERO[u.h];let sc2=H.cost*Math.pow(2.2,u.s-1)+u.s*1.5;
      for(const t of [H.o,H.c]){
        const set=new Set(chosen.map(x=>x.h).filter(h=>HERO[h].o===t||HERO[h].c===t));
        if(!set.has(u.h)){const n=set.size;if(tierOf(t,n+1)>tierOf(t,n))sc2+=3;else if(n>0)sc2+=.6;}
        if(P.fav&&P.fav.includes(t))sc2+=1;
      }
      if(sc2>bs){bs=sc2;bi=i;}
    });
    chosen.push(pool.splice(bi,1)[0]);
  }
  P.board.fill(null);P.bench.fill(null);
  const rest=pool;rest.forEach((u,i)=>{P.bench[i]=u;});
  const melee=chosen.filter(u=>MELEE.includes(HERO[u.h].c)).sort((a,b)=>MELEE.indexOf(HERO[a.h].c)-MELEE.indexOf(HERO[b.h].c));
  const rng=chosen.filter(u=>!MELEE.includes(HERO[u.h].c));
  const placeUnit=(u,slots)=>{
    for(const [r,c] of slots){
      const idx=r*4+c;
      if(!P.board[idx]){P.board[idx]=u;return true;}
    }
    return false;
  };
  melee.forEach(u=>placeUnit(u,MELEE_FORM_SLOTS));
  rng.forEach(u=>placeUnit(u,RANGED_FORM_SLOTS));
}

/* --- ván đấu --- */
const lossDamage=(r,s)=>Math.round((2+Math.floor(r*.6)-(r>15?1:0)+s*2)*(r>28?1.5:1));
const isPve=r=>PVE_ROUNDS.includes(r);
function incomeOf(p,r){
  const base=r<=2?2:r===3?3:r===4?4:5,s=Math.abs(p.streak);
  const sb=s<2?0:s<4?1:s<5?2:3;
  return {base,interest:Math.min(5,Math.floor(p.gold/10)),streak:sb,win:p.lastWin&&p.streak>0?1:0};
}
const BOT_NAMES=['Quan Lang','Mị Nương','Lạc Hầu','Lạc Tướng','Bồ Chính','Phụ Đạo','Hùng Vương'];
const AV8=['🐲','🐯','🐃','🦚','🐍','🦅','🐘','🦌'];
function newGame(cfg){
  cfg=cfg||{};
  const G={players:[],round:0,matches:[],diff:cfg.diff||1,auto:!!cfg.auto,over:false,winner:null,inc:null,pool:poolInit()};
  const myAv=cfg.av||'🐲',rest=AV8.filter(a=>a!==myAv);
  const me=newPlayer('Bạn',!cfg.auto,0,myAv);G.players.push(me);G.me=me;
  for(let i=0;i<7;i++){const b=newPlayer(BOT_NAMES[i],false,i+1,rest[i]);b.fav=[pickOf(['hongbang','aulac','khoinghia','lytran','lamson','tayson']),pickOf(['chienbinh','hove','cungno','thuatsi','dukich'])];G.players.push(b);}
  for(const p of G.players){
    const avail=BYCOST[1].filter(h=>poolCount(G,h)>0);
    const h=avail.length?pickOf(avail):pickOf(BYCOST[1]);
    if(addUnit(p,mkUnitObj(h,1)))poolTake(G,h);
  }
  return G;
}
function startRound(G){
  G.round++;const r=G.round;G.inc=null;
  for(const p of G.players){
    if(!p.alive)continue;
    if(r>1){
      const inc=incomeOf(p,r);let tot=inc.base+inc.interest+inc.streak+inc.win;
      if(!p.human)tot+=G.diff>1?1:G.diff<1?-1:0;
      p.gold+=Math.max(0,tot);p.xp+=2;levelCheck(p);
      if(p.human)G.inc={tot:Math.max(0,tot),inc};
    }
    if(p.human&&!G.auto)p.shop=rollShop(G,p);else botPrep(G,p);
  }
  G.matches=makeMatches(G);
}
function makeMatches(G){
  const A=G.players.filter(p=>p.alive);
  if(isPve(G.round))return A.map(p=>({a:p,b:null,pve:true}));
  shuffle(A);const ms=[];
  for(let i=0;i+1<A.length;i+=2)ms.push({a:A[i],b:A[i+1]});
  if(A.length%2){const last=A[A.length-1],others=A.filter(x=>x!==last);ms.push({a:last,b:pickOf(others),ghost:true});}
  for(const m of ms)if(!m.pve&&!m.ghost&&m.b.human){const t=m.a;m.a=m.b;m.b=t;}
  return ms;
}
function matchUnits(G,m){return [boardToUnits(m.a,0),m.pve?pveUnits(G.round):boardToUnits(m.b,1)];}
function simMatch(G,m,withEvents=false){const [ua,ub]=matchUnits(G,m);const B=runBattle(newBattle(ua.concat(ub),withEvents));const res={win0:B.winner===0,surv:B.surv,draw:B.winner===null,B};m.res=res;return res;}
function giveReward(G,p,r){
  const rw=PVE_RW[r];if(!rw)return null;
  const avail=BYCOST[rw.cost].filter(h=>poolCount(G,h)>0);
  if(avail.length){
    const h=pickOf(avail);
    if(canAdd(p,h)&&poolTake(G,h)){
      if(addUnit(p,mkUnitObj(h,1)))return {h,relic:!!rw.relic};
      poolReturn(G,h,1);
    }
  }
  p.gold+=rw.cost;
  return {gold:rw.cost,relic:!!rw.relic};
}
function addRelic(p,id){const r=RELICS.find(x=>x.id===id);p.relics.push(id);if(r.gold)p.gold+=r.gold;}
function applyRound(G){
  const info={};
  for(const m of G.matches){
    if(!m.res)m.res=simMatch(G,m);
    if(m.res.draw)continue;
    const {win0,surv}=m.res;
    if(m.pve){
      if(win0){if(m.a.human)info.reward=PVE_RW[G.round];else{const x=giveReward(G,m.a,G.round);if(x&&x.relic)addRelic(m.a,pickOf(RELICS).id);}}
      continue;
    }
    const dmg=lossDamage(G.round,surv);
    const win=p=>{p.streak=p.streak>0?p.streak+1:1;p.lastWin=true;};
    const lose=(p,d)=>{p.streak=p.streak<0?p.streak-1:-1;p.lastWin=false;p.hp-=d;};
    if(win0){win(m.a);if(!m.ghost)lose(m.b,dmg);}else{lose(m.a,dmg);if(!m.ghost)win(m.b);}
    if(m.a.human||(m.b&&m.b.human&&!m.ghost))info.dmg=dmg;
  }
  const n=G.players.filter(p=>p.alive).length;
  const dead=G.players.filter(p=>p.alive&&p.hp<=0).sort((a,b)=>b.hp-a.hp);
  dead.forEach((p,i)=>{p.alive=false;p.hp=Math.max(0,p.hp);p.place=n-dead.length+1+i;for(const u of [...p.board,...p.bench])if(u)poolReturn(G,u.h,copiesOf(u));p.board.fill(null);p.bench.fill(null);});
  const left=G.players.filter(p=>p.alive);
  if(left.length<=1){G.over=true;if(left[0]){left[0].place=1;G.winner=left[0];}}
  if(G.round>=70&&!G.over){G.over=true;const s=left.sort((a,b)=>b.hp-a.hp);s.forEach((p,i)=>p.place=i+1);G.winner=s[0];}
  return info;
}

/* --- máy chơi --- */
function ownedWeight(P,h){let n=0;for(const u of [...P.board,...P.bench])if(u&&u.h===h)n+=Math.pow(3,u.s-1);return n;}
function buyScore(P,h){
  const H=HERO[h];let sc2=H.cost*1.2;const own=ownedWeight(P,h);
  if(own>=1)sc2+=4+own;if(own>=2)sc2+=6;
  for(const t of [H.o,H.c])if(P.fav.includes(t))sc2+=2;
  const have=traitCounts(boardList(P));for(const t of [H.o,H.c])if(have[t])sc2+=1;
  if(H.cost>P.lvl-1&&own<1)sc2-=2;
  return sc2;
}
function bankKeep(r){return r<4?0:r<9?10:r<16?20:30;}
function targetLvl(r){return Math.min(9,2+Math.floor((r+1)/3.2));}
function benchSpace(G,P,h){
  if(canAdd(P,h))return true;
  let wi=-1,ws=1e9;
  P.bench.forEach((u,i)=>{if(!u||u.h===h)return;const v=HERO[u.h].cost*Math.pow(3,u.s-1);if(v<ws){ws=v;wi=i;}});
  if(wi>=0){sellUnit(G,P,'bench',wi);return true;}
  return false;
}
function botPrep(G,b){
  b.shop=rollShop(G,b);
  const k=G.diff,keep=bankKeep(G.round);let rerolls=0,guard=0;
  while(guard++<16){
    if(Math.random()>k)break;
    let did=false;
    const sc2=b.shop.map((h,i)=>h?{i,h,s:buyScore(b,h)}:null).filter(Boolean).sort((x,y)=>y.s-x.s);
    for(const s of sc2){
      const c=HERO[s.h].cost,pair=ownedWeight(b,s.h)>=1;
      if(b.gold>=c&&(b.gold-c>=keep||pair)&&s.s>0&&benchSpace(G,b,s.h)){if(buyUnit(G,b,s.i)){did=true;break;}}
    }
    if(did)continue;
    if(b.lvl<9&&b.lvl<targetLvl(G.round)&&b.gold>=4&&b.gold-4>=Math.max(0,keep-10)){buyXp(b);continue;}
    if(rerolls<4&&b.gold-2>=Math.max(keep,G.round>5?20:0)&&G.round>2){reroll(G,b);rerolls++;continue;}
    break;
  }
  autoArrange(b);
}
function playAuto(G,maxRounds){
  while(!G.over&&G.round<(maxRounds||80)){startRound(G);applyRound(G);}
  return G;
}
/*ENGINE_END*/

// ==========================================
// EXPORTS CHO SERVER SOCKET & SERVICES
// ==========================================
export {
  W, HH, TICK, MOVE_CD,
  HPC, ADC, SKM, COSTCOL, ODDS, XPN, PVE_ROUNDS, PVE_RW,
  CS, TR, BONDS, RELICS, HERO,
  heroStats, skillText, fxText,
  activeBonds, heroBonds,
  traitCounts, tierOf, boardList, boardCount,
  poolInit, poolCount, poolTake, poolReturn, copiesOf,
  newGame, newPlayer, mkUnitObj, levelCheck, rollShop, pickFromPool,
  mergeAll, addUnit, canAdd, buyUnit, sellValue, sellUnit, moveUnit,
  buyXp, reroll, autoArrange, incomeOf, startRound, makeMatches,
  matchUnits, simMatch, giveReward, addRelic, applyRound,
  botPrep, playAuto, newBattle, runBattle, step
};
