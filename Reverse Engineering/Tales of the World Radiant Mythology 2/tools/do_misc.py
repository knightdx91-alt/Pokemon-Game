import sys; sys.path.insert(0,'/tmp/psp')
from edit import *
import numpy as np, cv2
from PIL import Image
def rect_inpaint(im, box, r=4):
    a=np.array(im); m=np.zeros(a.shape[:2],np.uint8); x0,y0,x1,y1=box; m[y0:y1,x0:x1]=255
    a[:,:,:3]=cv2.inpaint(np.ascontiguousarray(a[:,:,:3]),m,r,cv2.INPAINT_TELEA); return Image.fromarray(a,'RGBA')
bright=lambda rgb: rgb.mean(axis=2)>165
# --- save icons (144x80)
P='/tmp/psp/png/'
im=Image.open(P+'save_savedata_icon0.png').convert('RGBA')
im=rect_inpaint(im,(30,53,114,71)); text(im,(72,62),'SAVE DATA',12,(40,90,220),True,(255,255,255),2,'mm')
im.save('/tmp/psp/edited/sd_icon0.png')
im=Image.open(P+'save_exsavedata_icon0.png').convert('RGBA')
im=rect_inpaint(im,(28,40,114,72)); text(im,(72,49),'EX ATTACK',11,(255,215,40),True,(110,50,10),2,'mm')
text(im,(72,63),'SAVE DATA',11,(255,215,40),True,(110,50,10),2,'mm'); im.save('/tmp/psp/edited/ex_icon0.png')
im=Image.open(P+'save_nisavedata_icon0.png').convert('RGBA')
im=rect_inpaint(im,(36,43,108,73)); text(im,(72,51),'LINKED SITE',10,(225,50,50),True,(255,255,255),2,'mm')
text(im,(72,65),'AUTH DATA',10,(225,50,50),True,(255,255,255),2,'mm'); im.save('/tmp/psp/edited/ni_icon0.png')
# --- save backgrounds (480x272): erase katakana reading under logo
for f in ['savedata','exsavedata','nisavedata','nesavedata']:
    im=Image.open(P+f'save_{f}_pic1.png').convert('RGBA')
    im=clone_rows(im,(194,62,388,75),14); im=soften_edges(im,(194,62,388,75)); im.save(f'/tmp/psp/edited/{f}_pic1.png')
# --- XMB background PIC1 (root)
im=Image.open('/tmp/psp/root_PIC1.PNG').convert('RGBA')
im.save('/tmp/psp/edited/root_PIC1_orig.png')
SERIF='/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'
from PIL import ImageFont, ImageDraw
im=Image.open('/tmp/psp/edited/root_PIC1_orig.png').convert('RGBA')
im=erase(im,(290,142,440,153),bright,grow=1)                       # katakana reading
im=rect_inpaint(im,(196,165,462,179),5)                            # tagline
d=ImageDraw.Draw(im); f=ImageFont.truetype(SERIF,11)
d.text((330,172),'Return to this land, and a radiant tale begins anew...',font=f,fill=(255,255,255),anchor='mm',stroke_width=1,stroke_fill=(30,40,110))
im=rect_inpaint(im,(194,256,452,270),4)                            # copyright row
text(im,(320,263),'©Mutsumi Inomata   ©Kosuke Fujishima   ©2006 2009 NBGI',9,(255,255,255),True,(20,30,80),1,'mm')
im.save('/tmp/psp/edited/root_PIC1.png')
# --- title copyright strip (304x16)
im=load('title/title.arc>lisence.ppt'); a=np.array(im)
a=np.array(im); flat=a.reshape(-1,4); vals,cnt=np.unique(flat,axis=0,return_counts=True); bgc=tuple(int(v) for v in vals[cnt.argmax()])
im=Image.new('RGBA',im.size,bgc)
text(im,(152,8),'©Mutsumi Inomata  ©Kosuke Fujishima  ©2006 2009 NBGI',9,(255,255,255),True,None,0,'mm')
im.save('/tmp/psp/edited/lisence.png')
# --- ending logo: erase katakana reading
im=load('credit/credit.arc>edlogo.ppt'); im=erase(im,(186,146,428,158),lambda rgb: rgb.mean(axis=2)>95,grow=1,radius=5); im.save('/tmp/psp/edited/edlogo.png')
