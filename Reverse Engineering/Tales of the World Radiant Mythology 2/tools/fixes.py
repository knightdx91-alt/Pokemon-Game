import re, textwrap
NAME=r'(?<![?!])\?\?(?![?!])'
def fix_name(s, has_name):
    if not has_name or not re.search(NAME,s): return s, False
    if re.search(r'\?\?\.\.',s): return s, False                 # "??..." trailing off: leave for a human
    t=s
    t=re.sub(r',\s*\?\?(?=[.!?])', '', t)                          # "Thank you, ??." -> "Thank you."
    t=re.sub(r'^\?\?[.,!]\s*', '', t)                               # "??. Come on" -> "Come on"
    t=re.sub(r'(?<=[.!?]\r\n)\?\?[.,!]\s*', '', t)                # only after a finished sentence
    t=re.sub(r'(^|(?<=[.!?] ))\?\?,\s*([a-z])', lambda m: m.group(1)+m.group(2).upper(), t)
    t=re.sub(r'(^|(?<=[.!?] ))\?\?,\s*', lambda m: m.group(1), t)
    if t and t[0].islower() and s.startswith('??'): t=t[0].upper()+t[1:]
    return t, (t!=s and not re.search(NAME,t))
def fix_tilde(s):
    if s.count('~')!=1: return s                 # singing / drawl: keep the tildes
    t=re.sub(r'~+(?=[.!?,…])','',s)              # "all~." -> "all."
    t=re.sub(r'(?<=[A-Za-z])~+(?=$|\r\n|\s)','!',t)  # "here~" -> "here!"
    t=re.sub(r'\s*~\s*$','',t); t=t.replace('~','')
    return t
def rewrap(s, width=42):
    lines=s.split('\r\n')
    if all(len(l)<=44 for l in lines): return s
    words=' '.join(l.strip() for l in lines).split(' ')
    out=textwrap.wrap(' '.join(words),width=width,break_long_words=False,break_on_hyphens=False)
    if len(out)>max(len(lines),4): return s       # would grow the box: leave for a human
    return '\r\n'.join(out)
