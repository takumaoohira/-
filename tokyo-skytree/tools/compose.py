import json,math,sys
from PIL import Image,ImageDraw,ImageFont
m=json.load(open('out/aerial_meta.json'))['18'];A=Image.open('out/aerial18.jpg')
def crop(cx,cz,size):
    sx=m['w']/(m['x1']-m['x0']);sz=m['h']/(m['z1']-m['z0'])
    a=((cx-size/2-m['x0'])*sx,(cz-size/2-m['z0'])*sz);b=((cx+size/2-m['x0'])*sx,(cz+size/2-m['z0'])*sz)
    return A.crop((int(a[0]),int(a[1]),int(b[0]),int(b[1]))).resize((900,900),Image.LANCZOS)
font=ImageFont.truetype('/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',28)
for i,(cx,cz,h,name) in enumerate([(10,0,1200,'スカイツリー周辺 約690m四方'),(-110,-35,450,'とうきょうスカイツリー駅付近 約260m四方'),(220,-20,450,'イーストタワー・押上駅付近 約260m四方')],1):
    size=2*(h+1.6)*math.tan(math.radians(16))
    g=Image.open(f'cmp_{i}.png').convert('RGB');a=crop(cx,cz,size)
    out=Image.new('RGB',(1840,980),(20,24,36));out.paste(a,(10,70));out.paste(g,(930,70))
    d=ImageDraw.Draw(out);d.text((10,18),f'左：国土地理院 シームレス空中写真　右：ゲーム画面（真上から・同じ範囲） — {name}',fill=(240,240,240),font=font)
    out.save(f'cmpA_{i}.jpg',quality=85)
