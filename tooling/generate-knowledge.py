# SPDX-License-Identifier: AGPL-3.0-only
# Original short abstractions, no copied modern commentary, predictions or diagnostic claims.
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
BASE='https://github.com/endview/metaphysics-skill-true-solar/blob/456100131d7f0492df9ac1d515d614d37515f9da/skills/'
def source(url,loc,license='AGPL-3.0-only; project-authored abstraction'):
 return dict(reference=url,locator=loc,license=license)
def card(cid,method,meaning,refs,src,pre=None,counter=None,**kw):
 return dict(card_id=cid,version='1.0.0',method=method,tradition_profile='project-explicit-conditions-v1',review_status='reviewed',
  review_scope='source-location, short paraphrase, counter-reading and inference boundary; not empirical validity',sources=src,
  meaning=meaning,prerequisites=pre or [dict(op='exists',pointer=x) for x in refs],fact_requirements=refs,
  counter_readings=counter or ['The opposite reading may apply when actual conditions, other structures, or candidate choices differ.'],
  not_inferable=['Hidden thoughts, location, diagnosis, equipment defects, moral worth, or guaranteed events.','A statistical probability or exact predicted date.'],
  use_policy='Conditional traditional reflection only. State supporting structure, a counter-reading, and relevant real-world evidence.',**kw)
def save(skill,cards):
 d=R/'skills'/skill/'knowledge';d.mkdir(exist_ok=True)
 (d/'cards.json').write_text(json.dumps(dict(schema='metaphysics.knowledge-cards.v1',version='1.0.0',cards=cards),ensure_ascii=False,indent=2)+'\n')
 # Entries describe sources, not a bundled full-text corpus.
 (d/'SOURCES.md').write_text('# Source and licensing review\n\nThe cards contain original concise abstractions, not source transcriptions. Sources support how a tradition describes a symbol, never real-world prediction validity. Each card includes source location, limitations and a counter-reading. Project additions are AGPL-3.0-only. Classical texts are public-domain content; no modern editorial text is copied. Modern iztro pages are cited for short conceptual labels only; their full text is not redistributed or relicensed.\n\nReviewed 2026-09-06. Review is an engineering/source review, not independent empirical or human expert certification.\n')
# Bazi framework, not an automated uniform auspiciousness score.
b=[]
for cid,theme,meaning in [
 ('strength','Strength','Assess season, roots, exposed stems, support and restraint jointly; counting elements is insufficient.'),
 ('climate','Seasonal climate','Discuss cold/warm and damp/dry separately from strength and pattern. A climate need is not automatically a strength remedy.'),
 ('pattern','Pattern','Name the school and all formation, disruption and rescue conditions. Retain alternatives when criteria are incomplete.'),
 ('useful','Useful element objective','Specify whether useful refers to strength, climate, pattern or mediation. Do not combine incompatible objectives under one label.'),
 ('relations','Relations','A fixed relation is only a detected structural relation. Missing members, seasonal conditions and competing relations can prevent transformation.'),
 ('timelayers','Time layers','Keep natal interpretation fixed before adding the supplied decadal or annual layer. Do not substitute an annual argument for month/day/hour.'),
 ('auxiliary','Auxiliary symbol policy','Unverified shensha, hidden combinations and arching relations do not override the main structure. Without a registered school table, acknowledge but do not interpret them.')]:
 ref='/checks_by_chart/{chart}/relationships' if cid=='relations' else '/checks_by_chart/{chart}/pillars'
 b.append(card('bazi.'+cid,'bazi',meaning,[ref,'/evidence/time_basis/verification_status'],
  [source(BASE+'analyze-bazi/references/analysis-workflow.md',theme),source(BASE+'analyze-bazi/references/relationships.md','Relation existence versus interpretation')],
  scopes=['traditional_structure','annual_cycle','multi_year_stage']))
save('analyze-bazi',b)
# Native tables map names to hexagram structures; themes are intentionally brief and non-predictive.
# Eight rows: upper qian, dui, li, zhen, xun, kan, gen, kun; lower in the same order.
themes=[
 ['initiative','careful conduct','shared purpose','without contrivance','encounter','dispute','withdrawal','blocked exchange'],
 ['resolution','pleasure and exchange','renewal','following','excessive load','constraint','mutual response','gathering'],
 ['abundance of resources','divergent views','clarity and attachment','addressing obstruction','reorganizing vessels','unfinished transition','temporary residence','advancement'],
 ['great force','role misalignment','fullness','awakening movement','continuity','release','small excess','readiness'],
 ['small accumulation','inner trust','household roles','increase','gradual entry','dispersion','gradual progress','observation'],
 ['waiting and provision','limits','completed transition','difficult beginnings','shared well','repeated difficulty','obstruction','association'],
 ['large accumulation','reduction','presentation','nourishment','repairing accumulated disorder','inexperience','stopping','erosion'],
 ['open exchange','approaching','obscured clarity','return','rising stepwise','organized collective','humility','receptivity']]
# Labels are identified by primary upper/lower trigram numbers, avoiding text aliases.
m=[]
classic=source('https://zh.wikisource.org/w/index.php?title=%E6%98%93%E5%82%B3/%E5%BA%8F%E5%8D%A6&oldid=2611127','Xu Gua, upper and lower sequences','Public-domain classical text; original short thematic abstraction')
for upper,row in enumerate(themes,1):
 for lower,theme in enumerate(row,1):
  m.append(card(f'meihua.hex.{upper}.{lower}','meihua','A possible symbolic theme is '+theme+'.',
   ['/result/primary/name','/result/primary/binaryBottomUp'],[classic],
   pre=[dict(op='equals',pointer='/result/primary/upper/number',value=upper),dict(op='equals',pointer='/result/primary/lower/number',value=lower)],
   counter=['The theme may describe a process or constraint rather than a favorable or unfavorable outcome; the frozen question and body/use relation take priority.'],scopes=['symbolic_event']))
for n,theme in enumerate(['initiative','receptive exchange','illumination','movement','entry','difficulty','restraint','receptivity'],1):
 m.append(card(f'meihua.trigram.{n}','meihua','Trigram reflection theme: '+theme+'.',
 ['/result/primary'],[source('https://zh.wikisource.org/wiki/%E6%98%93%E5%82%B3/%E8%AA%AA%E5%8D%A6','Shuo Gua, trigram qualities','Public-domain classical text; original short abstraction')],
 selector={'kind':'trigram','number':n},scopes=['symbolic_event']))
m.append(card('meihua.hierarchy','meihua','Interpret frozen question, primary hexagram, body/use, moving line, changed hexagram, then mutual and opposite/reversed views. Later symbols qualify, not reverse, the earlier analysis.',
 ['/result/primary','/result/bodyUse','/result/movingLine'],[source(BASE+'cast-meihua/references/interpretation.md','Interpretation priority')],scopes=['symbolic_event']))
save('cast-meihua',m)
# Ziwei labels only. No verbatim contemporary prose or numeric likelihoods copied.
star_names=['\u7d2b\u5fae','\u5929\u673a','\u592a\u9633','\u6b66\u66f2','\u5929\u540c','\u5ec9\u8d1e','\u5929\u5e9c','\u592a\u9634','\u8d2a\u72fc','\u5de8\u95e8','\u5929\u76f8','\u5929\u6881','\u4e03\u6740','\u7834\u519b']
star_themes=['coordination','planning','outward contribution','practical execution','comfort','self-restraint','stewardship','quiet care','exploration','expression','coordination and service','protection','decisive action','restructuring']
z=[]
for i,(name,theme) in enumerate(zip(star_names,star_themes),1):
 z.append(card(f'ziwei.star.{i}','ziwei','Traditional reflection label: '+theme+'.',
 ['/candidates/groups/{group}/facts/origin/palaces/{palace}/stars'],
 [source('https://iztro.com/learn/major-star',name+' section','Author retains source copyright; original very short conceptual paraphrase, no source article redistributed')],
 selector={'kind':'star','name':name},scopes=['traditional_structure','annual_cycle','multi_year_stage'],
 counter=['Brightness, accompanying stars, transformations, palace relationships and the requested time layer can materially change this reading. A single star does not establish a personal trait.']))
for i,theme in enumerate(['increase','responsibility','recognition','persistent concern']):
 z.append(card(f'ziwei.transformation.{i}','ziwei','Transformation reflection label: '+theme+'. It qualifies a star; it is not an independent event.',
 ['/candidates/groups/{group}/facts/{layer}'],[source('https://iztro.com/learn/mutagen',['Hua Lu','Hua Quan','Hua Ke','Hua Ji'][i],'Author retains source copyright; original very short conceptual paraphrase')],
 selector={'kind':'transformation','name':['\u7984','\u6743','\u79d1','\u5fcc'][i]},scopes=['traditional_structure','annual_cycle','multi_year_stage']))
for domain in ['career','migration','resources','relationships']:
 z.append(card('ziwei.domain.'+domain,'ziwei','For '+domain+', read the requested palace together with its three-direction/four-correct relations, transformations and selected time layer. Verify actual circumstances separately.',
 ['/candidates/groups/{group}/facts/{layer}'],[source(BASE+'analyze-ziwei/references/domain-map.md',domain),source(BASE+'analyze-ziwei/references/interpretation-workflow.md','Domain interpretation workflow')],
 selector={'kind':'domain','domain':domain},scopes=['traditional_structure','annual_cycle','multi_year_stage']))
save('analyze-ziwei',z)
print('Knowledge cards:',len(b),len(m),len(z),'total',len(b)+len(m)+len(z))
