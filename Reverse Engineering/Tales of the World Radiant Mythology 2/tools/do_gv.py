import sys; sys.path.insert(0,'/tmp/psp')
from edit import *
from PIL import ImageFont
import cv2, numpy as np
MARK='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def reddish(rgb): return (rgb[...,0]-np.minimum(rgb[...,1],rgb[...,2])>28)&(np.abs(rgb[...,1]-rgb[...,2])<45)
def sign(im, box, keep_below, lines):
    a=np.array(im); x0,y0,x1,y1=box
    m=np.zeros(a.shape[:2],np.uint8); m[y0:y1,x0:x1]=reddish(a[y0:y1,x0:x1,:3].astype(int))
    yellowish=lambda p: (p[0]>170)&(int(p[1])-int(p[2])>35)
    for x in range(x0,x1):                       # per column: find the GV letter's cream outline
        y=keep_below; seen=False; top=keep_below
        while y>y0:
            yl=yellowish(a[y,x,:3])
            if yl: seen=True
            elif seen: top=y+1; break
            y-=1
        if not seen: top=keep_below
        m[top-1:y1,x]=0                          # keep everything from the outline down
    m=cv2.dilate(m*255,np.ones((3,3),np.uint8),iterations=2)
    a[:,:,:3]=cv2.inpaint(np.ascontiguousarray(a[:,:,:3]),m,4,cv2.INPAINT_TELEA)
    im=Image.fromarray(a,'RGBA'); d=ImageDraw.Draw(im)
    for (cx,cy),s,sz in lines:
        d.text((cx,cy),s,font=ImageFont.truetype(MARK,sz),fill=(225,30,35),anchor='mm')
    return im
for lab,out in [('facechat/gv0507.arc>gv1.ppt','gv1'),('facechat/gv0502.arc>gv2.ppt','gv2')]:
    sign(load(lab),(168,44,306,140),134,[((236,64),'TALES OF',20),((239,103),'GOLDEN VICTORY',15)]).save(f'/tmp/psp/edited/{out}.png')
sign(load('common/network.arc>mercenary_bg14.ppt'),(36,36,126,96),92,[((72,48),'TALES OF',11),((81,70),'GOLDEN VICTORY',8)]).save('/tmp/psp/edited/mercenary_bg14.png')
from PIL import Image
a=Image.open('/tmp/psp/edited/gv1.png'); c=Image.open('/tmp/psp/edited/mercenary_bg14.png')
sh=Image.new('RGBA',(746,272)); sh.paste(a,(0,0)); sh.paste(c,(490,0)); sh.resize((1492,544),Image.NEAREST).save('/tmp/psp/prev_gv.png')
# card: too small for outline detection -> plain boxed colour mask
im=load('common/network.arc>mercenary_bg14.ppt')
im=erase(im,(38,38,108,59),reddish,grow=1,radius=3); im=erase(im,(38,59,124,79),reddish,grow=1,radius=3)
d=ImageDraw.Draw(im)
d.text((72,48),'TALES OF',font=ImageFont.truetype(MARK,11),fill=(225,30,35),anchor='mm')
d.text((81,69),'GOLDEN VICTORY',font=ImageFont.truetype(MARK,8),fill=(225,30,35),anchor='mm')
im.save('/tmp/psp/edited/mercenary_bg14.png')
im.crop((20,20,140,110)).resize((480,360),Image.NEAREST).save('/tmp/psp/prev_card.png')
