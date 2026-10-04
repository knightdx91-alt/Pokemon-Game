import cv2, numpy as np, json
from PIL import Image, ImageDraw, ImageFont
idx=json.load(open('/tmp/psp/index.json')); BYL={v['label']:h for h,v in idx.items()}
SANS='/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
SANSB='/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
def font(sz,bold=False): return ImageFont.truetype(SANSB if bold else SANS, sz)
def load(label): return Image.open(f'/tmp/psp/png/{BYL[label]}.png').convert('RGBA')
def erase(im, box, sel, grow=1, radius=3):
    """Inpaint pixels inside box where sel(rgb)->bool (the old lettering)."""
    a=np.array(im); x0,y0,x1,y1=box
    rgb=a[y0:y1,x0:x1,:3].astype(int)
    m=np.zeros(a.shape[:2],np.uint8); m[y0:y1,x0:x1]=sel(rgb).astype(np.uint8)*255
    if grow: m=cv2.dilate(m,np.ones((3,3),np.uint8),iterations=grow)
    out=cv2.inpaint(np.ascontiguousarray(a[:,:,:3]),m,radius,cv2.INPAINT_TELEA)
    a[:,:,:3]=out; return Image.fromarray(a,'RGBA')
def fill(im, box, color):
    d=ImageDraw.Draw(im); d.rectangle(box,fill=color); return im
def text(im, xy, s, sz, color=(255,255,255), bold=False, outline=None, ow=1, anchor='la', spacing=2):
    d=ImageDraw.Draw(im); f=font(sz,bold)
    d.multiline_text(xy,s,font=f,fill=color,anchor=anchor,spacing=spacing,
                     stroke_width=ow if outline else 0, stroke_fill=outline)
    return im
def wrap(s, sz, width, bold=False):
    f=font(sz,bold); words=s.split(); lines=[]; cur=''
    for w in words:
        t=(cur+' '+w).strip()
        if f.getlength(t)<=width: cur=t
        else: lines.append(cur); cur=w
    lines.append(cur); return '\n'.join(lines)
light=lambda rgb: rgb.min(axis=2)>150          # white/cream lettering
def rowfill(im, box, thresh=25):
    """Repaint each row of box with that row's median background (kills text + AA fringes)."""
    a=np.array(im); x0,y0,x1,y1=box
    for y in range(y0,y1):
        row=a[y,x0:x1,:3].astype(int); lum=row.mean(1)
        bg=np.median(row[lum<=np.percentile(lum,50)],axis=0)
        a[y,x0:x1,:3]=bg.astype(np.uint8)
    return Image.fromarray(a,'RGBA')
def clone_rows(im, box, dy):
    """Cover box with the same-size patch taken dy pixels below (texture-preserving)."""
    a=np.array(im); x0,y0,x1,y1=box; a[y0:y1,x0:x1]=a[y0+dy:y1+dy,x0:x1]; return Image.fromarray(a,'RGBA')
def soften_edges(im, box, k=3):
    """Blend the seam rows above/below a cloned box."""
    a=np.array(im).astype(float); x0,y0,x1,y1=box
    for y in (y0,y1-1):
        a[y,x0:x1]=(a[y-1,x0:x1]+a[y,x0:x1]+a[y+1,x0:x1])/3
    return Image.fromarray(a.astype(np.uint8),'RGBA')
