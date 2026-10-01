/** Feuille de style commune et par niveau. Les couleurs viennent des variables CSS posées sur chaque page. */
export const BASE_CSS = `
@page{size:297mm 210mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:297mm;background:#fff}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact;text-rendering:geometricPrecision}
.page{width:297mm;height:209.6mm;position:relative;overflow:hidden;break-after:page;page-break-after:always}
.page:last-child{break-after:auto;page-break-after:auto}
.content{position:absolute;z-index:5;display:flex;flex-direction:column;align-items:center;text-align:center}
.footer{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:flex-end}
.sig{width:250px;text-align:center}
.sig .simg{height:50px;display:flex;align-items:flex-end;justify-content:center}
.sig .simg img{max-height:50px;max-width:200px;object-fit:contain}
.sig .line{border-top:1.5px solid var(--primary);margin-top:4px}
.sig .lbl{font-size:14px;font-weight:600;margin-top:6px}
.sig .nm{font-size:13px;opacity:.75;margin-top:1px}
.verify{display:flex;flex-direction:column;align-items:center;gap:4px}
.qr svg{width:80px;height:80px;display:block}
.vcode{font-size:11px;letter-spacing:.08em;font-variant-numeric:tabular-nums;opacity:.85}
.place{font-size:12px;opacity:.75;white-space:nowrap}
.fr{position:absolute;inset:0}
.msg{text-wrap:balance}

/* ⭐ En-tête officiel style bulletin (Academia Helm) — République du Bénin + Ministère
   + nom école + slogan/adresse/tél/email + logo. Identique aux bulletins PDF. */
.school-header{width:100%;margin-bottom:6px;padding-bottom:6px;border-bottom:2px solid var(--primary,#0A2A5E)}
.school-header-table{width:100%;border-collapse:collapse}
.school-header-table td{vertical-align:middle;padding:2px 4px}
.sh-left{text-align:center;width:12%}
.sh-center{text-align:center;width:68%}
.sh-right{text-align:center;width:20%}
.sh-republique{font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px}
.sh-divider{margin:2px auto;width:50%}
.sh-divider-line{height:1px;background:var(--primary,#0A2A5E)}
.sh-ministere{font-size:8px;font-weight:bold;text-transform:uppercase;letter-spacing:.3px;line-height:1.3}
.sh-school-name{font-size:11px;font-weight:bold;text-transform:uppercase;margin-top:3px;color:var(--primary,#0A2A5E)}
.sh-school-info{font-size:7px;color:#555;margin-top:2px;font-style:italic}
`;

export const MATERNEL_CSS = `
.mat{background:var(--tint);font-family:'Fredoka',sans-serif;color:var(--ink)}
.mat .bubble{position:absolute;border-radius:50%;background:var(--soft);opacity:.5}
.mat .deco{position:absolute;color:var(--primary);opacity:.24}
.mat .frame{position:absolute;inset:22px;border:10px solid var(--primary);border-radius:46px}
.mat .frame::after{content:'';position:absolute;inset:10px;border:3px dashed var(--accent);border-radius:34px}
.mat .content{inset:60px 72px 64px}
.mat .badge-wrap{position:relative;margin-top:14px}
.mat .badge{width:128px;height:128px;border-radius:50%;background:var(--primary);display:grid;place-items:center;color:#fff;
  box-shadow:0 0 0 7px var(--tint),0 0 0 13px var(--accent),0 12px 0 13px rgba(0,0,0,.07)}
.mat .spark{position:absolute;color:var(--accent)}
.mat .kicker{margin-top:24px;font-size:15px;font-weight:500;letter-spacing:.24em;text-transform:uppercase}
.mat h1{font-size:60px;font-weight:700;line-height:1.05;color:var(--primary);margin-top:2px;
  text-shadow:0 3px 0 color-mix(in srgb,var(--ink) 14%,transparent)}
.mat .given{margin-top:4px;font-size:18px;opacity:.8}
.mat .name{margin-top:6px;font-weight:600;color:var(--ink);padding:0 30px 2px;border-bottom:4px dotted var(--accent);line-height:1.15}
.mat .class{margin-top:10px;font-size:20px}
.mat .msg{margin-top:12px;font-size:21px;max-width:720px;line-height:1.35}
.mat .score{margin-top:14px;display:inline-flex;align-items:center;gap:8px;background:var(--primary);color:#fff;
  padding:6px 22px;border-radius:30px;font-size:17px;font-weight:600}
.mat .photo{position:absolute;z-index:6;left:118px;top:150px;width:150px;height:150px;border-radius:50%;object-fit:cover;
  border:8px solid var(--primary);box-shadow:0 0 0 6px var(--tint),0 0 0 10px var(--accent)}
.mat .mascot{position:absolute;z-index:6;right:118px;top:150px;width:150px;height:150px;border-radius:50%;background:var(--soft);
  display:grid;place-items:center;color:var(--primary);border:8px solid var(--primary);box-shadow:0 0 0 6px var(--tint),0 0 0 10px var(--accent)}
.mat .sig .line{border-top:2.5px dotted var(--primary)}
.mat .qr{background:#fff;padding:5px;border-radius:12px;border:3px solid var(--soft)}
`;

export const PRIMAIRE_CSS = `
.pri{background:var(--primary);font-family:'Nunito',sans-serif;color:var(--ink)}
.pri .panel{position:absolute;inset:20px;background:var(--tint)}
.pri .panel::before{content:'';position:absolute;inset:10px;border:3px solid var(--accent)}
.pri .panel::after{content:'';position:absolute;inset:19px;border:1px solid var(--primary)}
.pri .side{position:absolute;top:84px;bottom:84px;width:54px;display:flex;flex-direction:column;justify-content:space-around;align-items:center;color:var(--primary);opacity:.15}
.pri .side.l{left:50px}.pri .side.r{right:50px}
.pri .corner{position:absolute;width:62px;height:62px;border:0 solid var(--accent)}
.pri .corner.tl{top:36px;left:36px;border-width:4px 0 0 4px;border-radius:62px 0 0 0}
.pri .corner.tr{top:36px;right:36px;border-width:4px 4px 0 0;border-radius:0 62px 0 0}
.pri .corner.bl{bottom:36px;left:36px;border-width:0 0 4px 4px;border-radius:0 0 0 62px}
.pri .corner.br{bottom:36px;right:36px;border-width:0 4px 4px 0;border-radius:0 0 62px 0}
.pri .wm{position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);color:var(--primary);opacity:.04}
.pri .content{inset:56px 128px 52px}
.pri .medal{position:relative;z-index:2;margin-top:10px;width:104px;height:104px;border-radius:50%;
  background:radial-gradient(circle at 30% 28%,color-mix(in srgb,var(--accent) 55%,#fff),var(--accent) 65%);
  border:5px solid var(--primary);display:grid;place-items:center;color:var(--primary);
  box-shadow:0 0 0 5px var(--tint),0 0 0 8px var(--accent)}
.pri .tails{position:relative;z-index:1;display:flex;gap:8px;margin-top:-14px}
.pri .tail{width:28px;height:50px;background:var(--primary);clip-path:polygon(0 0,100% 0,100% 100%,50% 80%,0 100%)}
.pri .banner{position:relative;isolation:isolate;margin-top:8px;background:var(--primary);color:#fff;padding:8px 52px;
  font-weight:800;letter-spacing:.06em;text-transform:uppercase;line-height:1.15}
.pri .banner::before,.pri .banner::after{content:'';position:absolute;top:14px;width:48px;height:100%;z-index:-1;
  background:color-mix(in srgb,var(--primary) 72%,#000)}
.pri .banner::before{left:-36px;clip-path:polygon(0 0,100% 0,100% 100%,0 100%,22px 50%)}
.pri .banner::after{right:-36px;clip-path:polygon(0 0,100% 0,calc(100% - 22px) 50%,100% 100%,0 100%)}
.pri .sub{margin-top:8px;font-size:24px;font-weight:800;font-style:italic;color:color-mix(in srgb,var(--accent) 62%,#000)}
.pri .given{margin-top:10px;font-size:16px;font-weight:600}
.pri .name{margin-top:2px;font-weight:800;color:var(--primary);line-height:1.15;padding:0 20px 4px;border-bottom:2px solid var(--accent)}
.pri .class{margin-top:8px;font-size:18px;font-weight:600}
.pri .chips{display:flex;gap:14px;margin-top:10px}
.pri .chip{display:flex;align-items:center;gap:8px;background:#fff;border:2px solid var(--soft);border-radius:999px;padding:5px 16px;font-weight:700;font-size:16px}
.pri .chip svg{color:var(--primary)}
.pri .msg{margin-top:10px;font-size:19px;font-weight:600;font-style:italic;max-width:760px;line-height:1.35}
.pri .qr{background:#fff;padding:5px;border-radius:8px;border:2px solid var(--soft)}
`;

export const SECONDAIRE_CSS = `
.sec{background:var(--tint);font-family:'Lora',serif;color:var(--ink)}
.sec .guil{position:absolute;left:0;top:0;width:100%;height:100%}
.sec .wm{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);color:var(--primary);opacity:.05}
.sec .f1{position:absolute;inset:20px;border:5px solid var(--primary)}
.sec .f2{position:absolute;inset:30px;border:1px solid var(--primary)}
.sec .f3{position:absolute;inset:36px;border:1.5px solid var(--accent)}
.sec .orn{position:absolute;width:13px;height:13px;background:var(--accent);transform:rotate(45deg);outline:3px solid var(--tint)}
.sec .content{inset:52px 96px 48px}
.sec .year{font-size:13px;font-style:italic;margin-top:4px;opacity:.8}
.sec .div{display:flex;align-items:center;gap:10px;width:360px;margin-top:10px}
.sec .div i{flex:1;height:1px;background:var(--accent)}
.sec .div b{width:9px;height:9px;background:var(--accent);transform:rotate(45deg)}
.sec h1{font-family:'Playfair Display',serif;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--primary);margin-top:26px;line-height:1.1}
.sec .sub{font-family:'Playfair Display',serif;font-style:italic;font-weight:500;font-size:27px;color:color-mix(in srgb,var(--accent) 60%,#000);margin-top:6px}
.sec .given{font-style:italic;font-size:18px;margin-top:24px}
.sec .name{font-family:'Playfair Display',serif;font-style:italic;font-weight:700;color:var(--primary);margin-top:16px;line-height:1.15;padding:0 26px 4px;border-bottom:1.5px solid var(--accent)}
.sec .class{font-size:19px;margin-top:12px}
.sec .msg{font-style:italic;font-size:19px;margin-top:18px;max-width:860px;line-height:1.45}
.sec .stat{white-space:pre;margin-top:22px;font-weight:600;font-size:16px;letter-spacing:.04em;color:color-mix(in srgb,var(--accent) 60%,#000)}
.sec .seal{position:relative;width:104px;height:104px;border-radius:50%;display:grid;place-items:center;color:var(--tint);margin-bottom:2px;
  background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--accent) 55%,#fff),var(--accent) 60%,color-mix(in srgb,var(--accent) 70%,#000));
  border:2px solid var(--primary);box-shadow:0 2px 0 rgba(0,0,0,.12)}
.sec .seal::before{content:'';position:absolute;inset:7px;border:2px dashed var(--tint);border-radius:50%}
.sec .seal::after{content:'';position:absolute;inset:14px;border:1.5px solid color-mix(in srgb,var(--tint) 80%,transparent);border-radius:50%}
.sec .qrcorner{position:absolute;left:0;bottom:0;display:flex;flex-direction:column;align-items:center;gap:3px}
.sec .qrcorner .qr svg{width:62px;height:62px}
.sec .qrcorner .vcode{font-size:8.5px}
.sec .sig .lbl{font-style:italic;font-weight:500}
.sec .sig{width:230px}
.sec .footer{padding:0 150px 0 150px}
`;

export const BOARD_CSS = `
.board .content{align-items:stretch;text-align:left}
.board .head{display:flex;flex-direction:column;align-items:center;text-align:center}
.board h1{line-height:1.1}
.board .sub2{margin-top:4px;font-size:18px;opacity:.85}
.board table{width:100%;border-collapse:separate;border-spacing:0 5px;margin-top:12px}
.board th{background:var(--primary);color:#fff;padding:9px 16px;font-size:15px;letter-spacing:.06em;text-transform:uppercase;text-align:left}
.board th:first-child,.board td:first-child{border-radius:12px 0 0 12px;width:84px;text-align:center}
.board th:last-child,.board td:last-child{border-radius:0 12px 12px 0;text-align:center;width:250px}
.board th.num,.board td.num{text-align:center;width:170px}
.board td{padding:7px 16px;background:color-mix(in srgb,var(--soft) 38%,#fff);font-size:19px;font-weight:600}
.board td.rk{font-weight:800;font-size:20px}
.board td.rk svg{vertical-align:middle}
.board .pill{display:inline-flex;align-items:center;gap:7px;padding:4px 14px;border-radius:999px;color:#fff;font-weight:700;font-size:14px;background:var(--pc)}
.board .foot{position:absolute;left:0;right:0;bottom:0;text-align:center;font-size:13px;opacity:.75}
.board.mat .content{inset:60px 100px 50px}
.board.pri .content{inset:56px 120px 50px}
.board.sec .content{inset:58px 110px 50px}
.board.mat h1{font-size:46px;font-weight:700;color:var(--primary)}
.board.pri h1{font-size:44px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:.05em}
.board.sec h1{font-family:'Playfair Display',serif;font-size:44px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.06em}
.board.sec .sub2{font-style:italic}
.board.sec td{font-weight:500}
`;

export const ALL_CSS = [BASE_CSS, MATERNEL_CSS, PRIMAIRE_CSS, SECONDAIRE_CSS, BOARD_CSS].join('\n');
