# 質感用テクスチャ（色・法線・粗さ/金属）を手続き的に生成。FFT ノイズなので継ぎ目なしで繰り返せる。
import numpy as np
from PIL import Image, ImageDraw
OUT='tex/'
rng=np.random.default_rng(7)
def fnoise(n,beta=2.0,seed=0,m=None):
    m=m or n;r=np.random.default_rng(seed);w=r.standard_normal((m,n))
    fy=np.fft.fftfreq(m)[:,None];fx=np.fft.fftfreq(n)[None,:];f=np.sqrt(fx*fx+fy*fy);f[0,0]=1
    F=np.fft.fft2(w)/f**(beta/2);F[0,0]=0;a=np.real(np.fft.ifft2(F));a-=a.mean();a/=a.std()+1e-9;return a
def normal(h,s=4.0):
    dx=(np.roll(h,-1,1)-np.roll(h,1,1))*0.5*s;dy=(np.roll(h,-1,0)-np.roll(h,1,0))*0.5*s
    n=np.dstack([-dx,dy,np.ones_like(h)]);n/=np.linalg.norm(n,axis=2,keepdims=True);return ((n*0.5+0.5)*255).clip(0,255).astype(np.uint8)
def save(name,alb,h,rough,metal=None,ns=4.0,q=86):
    Image.fromarray(np.clip(alb,0,255).astype(np.uint8)).save(OUT+name+'_c.jpg',quality=q)
    Image.fromarray(normal(h,ns)).save(OUT+name+'_n.jpg',quality=q)
    if metal is None: metal=np.zeros_like(rough)
    orm=np.dstack([np.full_like(rough,255),rough*255,metal*255]).clip(0,255).astype(np.uint8)
    Image.fromarray(orm).save(OUT+name+'_r.jpg',quality=q)
def rgb(c):return np.array([int(c[1:3],16),int(c[3:5],16),int(c[5:7],16)],float)

# ---- 1. 舗石（4F 広場など）：2.4m 角、0.6×0.3m の石を馬目地、色の違う帯を混ぜる
N=1024;px=N/2.4
alb=np.zeros((N,N,3));h=np.zeros((N,N));rough=np.zeros((N,N))
spk=fnoise(N,0.3,1);mott=fnoise(N,2.2,2)
for row in range(8):
    y0=int(row*0.3*px);y1=int((row+1)*0.3*px);off=0.3*px if row%2 else 0
    for k in range(-1,5):
        x0=int(k*0.6*px+off);x1=int((k+1)*0.6*px+off)
        tone=rng.choice([rgb('#a6a7a3'),rgb('#9fa09c'),rgb('#b0b0ab'),rgb('#979895'),rgb('#b8b7b1')],p=[.3,.25,.2,.15,.1])*(0.97+0.06*rng.random())
        xs=np.arange(x0,x1)%N
        alb[y0:y1][:,xs]=tone;h[y0:y1][:,xs]=1+0.15*rng.random();rough[y0:y1][:,xs]=0.68+0.12*rng.random()
# 目地と面取り
j=4
for row in range(9):
    y=int(row*0.3*px)%N;alb[max(0,y-j//2):y+j//2]*=0.55;h[max(0,y-j//2):y+j//2]=0;rough[max(0,y-j//2):y+j//2]=0.95
for row in range(8):
    y0=int(row*0.3*px);y1=int((row+1)*0.3*px);off=0.3*px if row%2 else 0
    for k in range(-1,6):
        x=int(k*0.6*px+off)%N;sl=slice(max(0,x-j//2),x+j//2)
        alb[y0:y1,sl]*=0.55;h[y0:y1,sl]=0;rough[y0:y1,sl]=0.95
from scipy.ndimage import gaussian_filter
h=gaussian_filter(h,1.6,mode='wrap')+0.05*spk+0.08*mott
alb*= (1+0.06*np.clip(spk,-2,2)[...,None]*0.5+0.03*mott[...,None])
save('paving',alb,h,rough,ns=5)

# ---- 2. コンクリート：2.4m 角、型枠の継ぎ目（1.2×0.6m）とセパ穴、雨だれのしみ
N=1024;px=N/2.4
base=rgb('#aeaba4');m1=fnoise(N,2.4,11);m2=fnoise(N,1.2,12);streak=gaussian_filter(np.random.default_rng(13).standard_normal((N,N)),(40,1.2),mode='wrap');streak/=streak.std()
alb=np.ones((N,N,3))*base*(1+0.07*m1+0.03*m2-0.05*np.clip(streak,0,3))[...,None]
h=0.25*m1+0.15*fnoise(N,0.5,14);rough=0.86+0.05*m2
for y in np.arange(0,2.4,0.6):
    yy=int(y*px);alb[yy:yy+2]*=0.86;h[yy:yy+2]-=0.6
for x in np.arange(0,2.4,1.2):
    xx=int(x*px);alb[:,xx:xx+2]*=0.86;h[:,xx:xx+2]-=0.6
yy,xx=np.mgrid[0:N,0:N]
for y in np.arange(0.15,2.4,0.3):
    for x in np.arange(0.3,2.4,0.6):
        d=np.hypot(((xx-x*px+N/2)%N)-N/2,((yy-y*px+N/2)%N)-N/2);msk=d<5
        alb[msk]*=0.6;h[msk]-=1.5
pores=fnoise(N,0.0,15)>2.6;alb[pores]*=0.75;h[pores]-=0.8
save('concrete',alb,gaussian_filter(h,0.8,mode='wrap'),rough,ns=3)

# ---- 3. アスファルト（道路・地面の細かな凹凸）：1m 角
N=512
g=fnoise(N,0.2,21);g2=fnoise(N,1.8,22)
alb=np.ones((N,N,3))*rgb('#45464a')*(1+0.10*g2)[...,None]
st=g>1.2;alb[st]=alb[st]*1.9;dk=g<-1.5;alb[dk]*=0.55
h=0.5*np.clip(g,-1,3)+0.2*g2;rough=0.9+0.04*g2-0.1*st
save('asphalt',alb,gaussian_filter(h,0.6,mode='wrap'),rough,ns=6)

# ---- 4. 塗装した鋼材（タワー・手すり・鉄骨）：1m 角、ゆず肌とわずかな汚れ
N=512
o=fnoise(N,1.0,31);d=fnoise(N,2.6,32)
alb=np.ones((N,N,3))*rgb('#f4f5f6')*(1-0.04*np.clip(d,0,3))[...,None]
save('paint',alb,0.15*o,0.42+0.03*d,metal=np.full((N,N),0.15),ns=1.2)

# ---- 5. 外壁（既存のキャンバスと同じ窓の配置を4倍の解像度で描く。夜の窓明かりはゲーム側の配置と一致）
def facade(kind):
    S=4;W=256*S
    im=Image.new('RGB',(W,W));dr=ImageDraw.Draw(im)
    hm=Image.new('L',(W,W),128);dh=ImageDraw.Draw(hm)       # 高さ：128=壁面
    rm=Image.new('L',(W,W),220);drr=ImageDraw.Draw(rm)      # 粗さ
    mm=Image.new('L',(W,W),0);dmm=ImageDraw.Draw(mm)        # 金属
    R=lambda x,y,w,h:[x*S,y*S,(x+w)*S-1,(y+h)*S-1]
    if kind=='res':   # マンション：タイル壁・窓・バルコニー
        dr.rectangle([0,0,W,W],fill='#d6d0c4')
        for ty in range(0,W,10):dr.line([0,ty,W,ty],fill='#c9c2b5')       # 二丁掛けタイルの目地
        for ty in range(0,W,10):
            for tx in range((ty//10%2)*24,W,48):dr.line([tx,ty,tx,ty+10],fill='#c9c2b5')
        for fy in range(4):
            for fx in range(4):
                x,y=fx*64,fy*64
                for (a,b,c,d,col) in [(x+8,y+14,30,34,'#3e4954'),(x+42,y+18,16,24,'#4d5964')]:
                    dr.rectangle(R(a-1,b-1,c+2,d+2),fill='#b8bcc0');dmm.rectangle(R(a-1,b-1,c+2,d+2),fill=200);drr.rectangle(R(a-1,b-1,c+2,d+2),fill=90)
                    dr.rectangle(R(a,b,c,d),fill=col);dh.rectangle(R(a,b,c,d),fill=70);drr.rectangle(R(a,b,c,d),fill=18);dmm.rectangle(R(a,b,c,d),fill=150)
                    dr.rectangle(R(a+c//2,b,1,d),fill='#b8bcc0');dh.rectangle(R(a+c//2,b,1,d),fill=110)
                dr.rectangle(R(x,y+46,64,8),fill='#ece8df');dh.rectangle(R(x,y+46,64,8),fill=210);drr.rectangle(R(x,y+46,64,8),fill=200)
                dr.rectangle(R(x,y+54,64,3),fill='#8a857c');dh.rectangle(R(x,y+54,64,3),fill=170)
                for k in range(x,x+64,3):dr.line([k*S,(y+40)*S,k*S,(y+46)*S],fill='#9aa0a6');dh.line([k*S,(y+40)*S,k*S,(y+46)*S],fill=190)  # 手すり
        m=12
    elif kind=='com':  # 事務所・店舗：石張り＋窓
        dr.rectangle([0,0,W,W],fill='#bcbfc2')
        for ty in range(0,W,32):dr.line([0,ty,W,ty],fill='#a8abae',width=2);dh.line([0,ty,W,ty],fill=100,width=2)
        for tx in range(0,W,64):dr.line([tx,0,tx,W],fill='#a8abae',width=2);dh.line([tx,0,tx,W],fill=100,width=2)
        for fy in range(4):
            for fx in range(4):
                x,y=fx*64,fy*64
                dr.rectangle(R(x+4,y+9,56,42),fill='#8f959b');dmm.rectangle(R(x+4,y+9,56,42),fill=210);drr.rectangle(R(x+4,y+9,56,42),fill=80);dh.rectangle(R(x+4,y+9,56,42),fill=96)
                dr.rectangle(R(x+5,y+10,54,40),fill='#33404d');dh.rectangle(R(x+5,y+10,54,40),fill=60);drr.rectangle(R(x+5,y+10,54,40),fill=14);dmm.rectangle(R(x+5,y+10,54,40),fill=160)
                dr.rectangle(R(x+31,y+10,2,40),fill='#9ca1a6');dh.rectangle(R(x+31,y+10,2,40),fill=100);dmm.rectangle(R(x+31,y+10,2,40),fill=220);drr.rectangle(R(x+31,y+10,2,40),fill=80)
                dr.rectangle(R(x+3,y+50,58,2),fill='#d0d2d4');dh.rectangle(R(x+3,y+50,58,2),fill=170)
        m=14
    elif kind=='cw':   # カーテンウォール
        for y in range(W):
            t=y/W;c=(int(93-30*t),int(117-30*t),int(144-32*t));dr.line([0,y,W,y],fill=c)
        dh.rectangle([0,0,W,W],fill=100);drr.rectangle([0,0,W,W],fill=10);dmm.rectangle([0,0,W,W],fill=180)
        for y in range(4):
            dr.rectangle(R(0,y*64+56,256,8),fill='#56677a');drr.rectangle(R(0,y*64+56,256,8),fill=60)
            dr.rectangle(R(0,y*64+60,256,4),fill='#c9d3dc');dh.rectangle(R(0,y*64+60,256,4),fill=170);drr.rectangle(R(0,y*64+60,256,4),fill=70);dmm.rectangle(R(0,y*64+60,256,4),fill=230)
        for x in range(8):
            dr.rectangle(R(x*32,0,2,256),fill='#c9d3dc');dh.rectangle(R(x*32,0,2,256),fill=170);drr.rectangle(R(x*32,0,2,256),fill=70);dmm.rectangle(R(x*32,0,2,256),fill=230)
        m=8
    else:              # ソラマチ：白い金属パネルとガラス帯
        dr.rectangle([0,0,W,W],fill='#e7e9ea');drr.rectangle([0,0,W,W],fill=110);dmm.rectangle([0,0,W,W],fill=120)
        for x in range(0,256,32):dr.line([x*S,0,x*S,W],fill='#cfd3d6',width=3);dh.line([x*S,0,x*S,W],fill=100,width=3)
        for y in range(0,256,16):dr.line([0,y*S,W,y*S],fill='#d7dadc',width=2);dh.line([0,y*S,W,y*S],fill=105,width=2)
        for f in range(2):
            y=f*128
            dr.rectangle(R(0,y+70,256,46),fill='#4f6273');dh.rectangle(R(0,y+70,256,46),fill=72);drr.rectangle(R(0,y+70,256,46),fill=12);dmm.rectangle(R(0,y+70,256,46),fill=170)
            dr.rectangle(R(0,y+66,256,4),fill='#f4f5f5');dh.rectangle(R(0,y+66,256,4),fill=200)
            for x in range(0,256,16):dr.rectangle(R(x,y+70,3,46),fill='#c9cdd0');dh.rectangle(R(x,y+70,3,46),fill=120);dmm.rectangle(R(x,y+70,3,46),fill=230);drr.rectangle(R(x,y+70,3,46),fill=70)
        m=None
    a=np.asarray(im).astype(float);hh=np.asarray(hm).astype(float)/255;rr=np.asarray(rm).astype(float)/255;mt=np.asarray(mm).astype(float)/255
    n1=fnoise(W,2.2,hash(kind)%1000);n2=fnoise(W,0.4,hash(kind)%1000+1)
    wall=hh>0.45
    grime=gaussian_filter(np.random.default_rng(5).standard_normal((W,W)),(30,2),mode='wrap');grime/=grime.std()
    a*= (1+np.where(wall,0.05*n1+0.02*n2-0.035*np.clip(grime,0,3),0.03*n1))[...,None]
    h=gaussian_filter(hh,1.2,mode='wrap')+np.where(wall,0.01*n2,0)
    rr=np.clip(rr+np.where(wall,0.05*n1,0.04*n1),0.03,1)
    save('f_'+kind,a,h,rr,metal=mt,ns=10,q=84)
for k in ['res','com','cw','sola']:facade(k)
print('ok')
