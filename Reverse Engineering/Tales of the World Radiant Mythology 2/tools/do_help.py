import sys; sys.path.insert(0,'/tmp/psp')
from edit import *
for src in ['puzzle/hex/hex_help_0.ppt.gz','puzzle/hex/hex_help_1.ppt.gz']:
    im=load(src); page=src[-8]
    im=rowfill(im,(232,62,420,79))                       # header "あそびかた (n/2)"
    text(im,(234,63),f'How to Play ({int(page)+1}/2)',11,(255,255,255))
    if page=='0':
        im=rowfill(im,(232,90,450,216))
        body=('This is a picture puzzle: put the scattered image back the way it was. '
              'Press Left/Right on the D-pad to move the Cursor counter-clockwise or clockwise, '
              'then press ○ to shift the Pieces in the direction of the cursor arrows.')
        text(im,(234,95),wrap(body,11,208),11,(255,255,255),spacing=4)
        im=erase(im,(46,47,108,66),light); text(im,(77,57),'Cursor',11,(255,255,255),anchor='mm')
        im=erase(im,(73,222,124,242),light); text(im,(99,232),'Piece',11,(255,255,255),anchor='mm')
    else:
        im=rowfill(im,(232,90,450,216))
        body='Combine cursor moves and shifts skillfully to restore the picture and clear the puzzle.'
        text(im,(234,98),wrap(body,11,208),11,(255,255,255),spacing=4)
        im=erase(im,(98,140,146,162),light); text(im,(122,151),'Complete!',11,(255,255,255),anchor='mm')
    im.save(f'/tmp/psp/edited/hex_help_{page}.png')
from PIL import Image
a=Image.open('/tmp/psp/edited/hex_help_0.png'); b=Image.open('/tmp/psp/edited/hex_help_1.png')
s=Image.new('RGBA',(960,272)); s.paste(a,(0,0)); s.paste(b,(480,0)); s.resize((1920,544),Image.NEAREST).save('/tmp/psp/prev_help.png')
