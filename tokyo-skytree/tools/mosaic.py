import math,json
from PIL import Image
LAT0,LON0=35.710063,139.8107
MLAT=111000; MLON=111000*math.cos(math.radians(LAT0))
def t2g(z,x,y):
    n=2**z; lon=x/n*360-180; lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*y/n))))
    return ((lon-LON0)*MLON, -(lat-LAT0)*MLAT)
meta={}
for (z,d,X0,X1,Y0,Y1,maxw,q) in [(18,'a18',232874,232884,103195,103206,4096,80),(16,'a16',58213,58226,25794,25806,2048,82),(14,'a14',14549,14560,6444,6455,2048,82)]:
    W=(X1-X0+1)*256;H=(Y1-Y0+1)*256;im=Image.new('RGB',(W,H))
    for x in range(X0,X1+1):
        for y in range(Y0,Y1+1):
            try: im.paste(Image.open(f'{d}/{z}_{x}_{y}.jpg' if False else f'{d}/{x}_{y}.jpg').convert('RGB'),((x-X0)*256,(y-Y0)*256))
            except Exception as e: print('miss',z,x,y,e)
    s=min(1,maxw/max(W,H)); im=im.resize((int(W*s),int(H*s)),Image.LANCZOS)
    im.save(f'out/aerial{z}.jpg',quality=q)
    a=t2g(z,X0,Y0);b=t2g(z,X1+1,Y1+1)
    meta[z]={'x0':round(a[0],2),'z0':round(a[1],2),'x1':round(b[0],2),'z1':round(b[1],2),'w':im.width,'h':im.height}
    print(z,meta[z])
json.dump(meta,open('out/aerial_meta.json','w'))
