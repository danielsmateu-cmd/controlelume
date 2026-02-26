import re

with open("src/pages/Orcamentos.jsx", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Replace the inner table classes and paddings for compactness
text = text.replace('className="px-4 py-3 text-xs font-bold uppercase" rowSpan="2"', 'className="px-3 py-1.5 text-[11px] font-bold uppercase" rowSpan="2"')
text = text.replace('className="px-4 py-3 text-[10px] font-bold uppercase text-center border-l border-indigo-500" colSpan="2"', 'className="px-2 py-1.5 text-[10px] font-bold uppercase text-center border-l border-indigo-500" colSpan="2"')
text = text.replace('className="px-4 py-3 text-[10px] font-bold uppercase text-right border-l border-indigo-500 pr-8" rowSpan="2"', 'className="px-3 py-1.5 text-[10px] font-bold uppercase text-right border-l border-indigo-500 pr-8" rowSpan="2"')

text = text.replace('className="px-2 py-2 text-[9px] font-bold uppercase text-center border-l border-indigo-400"', 'className="px-1 py-1 text-[9px] font-bold uppercase text-center border-l border-indigo-400"')

text = text.replace('className="px-4 py-2 text-sm font-bold text-gray-700 bg-gray-50/50"', 'className="px-3 py-1 text-[11px] font-bold text-gray-700 bg-gray-50/50"')
text = text.replace('className="px-4 py-2 text-sm font-bold text-emerald-700 bg-emerald-50/30"', 'className="px-3 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50/30"')
text = text.replace('className="px-4 py-2 text-sm font-bold text-amber-700 bg-amber-50/30"', 'className="px-3 py-1 text-[11px] font-bold text-amber-700 bg-amber-50/30"')

text = text.replace('<span className="text-[10px] font-normal text-emerald-500 ml-1">(por unidade)</span>', '<span className="text-[9px] font-normal text-emerald-500 ml-1">(unidade)</span>')
text = text.replace('<span className="text-[10px] font-normal text-amber-500 ml-1">(metro linear)</span>', '<span className="text-[9px] font-normal text-amber-500 ml-1">(m linear)</span>')

text = text.replace('className="px-2 py-2 border-l border-gray-100"', 'className="px-1 py-1 border-l border-gray-100"')
text = text.replace('className="w-full px-2 py-1 text-center text-sm border border-gray-200 rounded focus:ring-1 focus:ring-indigo-400 outline-none"', 'className="w-full px-1 py-0.5 text-center text-[11px] border border-gray-200 rounded focus:ring-1 focus:ring-indigo-400 outline-none"')
text = text.replace('className="w-full px-2 py-1 text-center text-sm border border-emerald-200 rounded focus:ring-1 focus:ring-emerald-400 outline-none"', 'className="w-full px-1 py-0.5 text-center text-[11px] border border-emerald-200 rounded focus:ring-1 focus:ring-emerald-400 outline-none"')
text = text.replace('className="w-full px-2 py-1 text-center text-sm border border-amber-200 rounded focus:ring-1 focus:ring-amber-400 outline-none"', 'className="w-full px-1 py-0.5 text-center text-[11px] border border-amber-200 rounded focus:ring-1 focus:ring-amber-400 outline-none"')

text = text.replace('className="px-4 py-2 border-l border-gray-100 text-right font-bold text-gray-800 text-sm pr-8"', 'className="px-3 py-1 border-l border-gray-100 text-right font-bold text-gray-800 text-[11px] pr-8"')
text = text.replace('className="px-4 py-2 border-l border-gray-100 text-right font-bold text-emerald-700 text-sm pr-8"', 'className="px-3 py-1 border-l border-gray-100 text-right font-bold text-emerald-700 text-[11px] pr-8"')
text = text.replace('className="px-4 py-2 border-l border-gray-100 text-right font-bold text-amber-700 text-sm pr-8"', 'className="px-3 py-1 border-l border-gray-100 text-right font-bold text-amber-700 text-[11px] pr-8"')

text = text.replace('className="px-4 py-10 text-center text-gray-400 italic"', 'className="px-3 py-6 text-[11px] text-center text-gray-400 italic"')

text = text.replace('className="px-4 py-4 text-xs font-black text-gray-600 uppercase"', 'className="px-3 py-2 text-[10px] font-black text-gray-500 uppercase text-right"')
text = text.replace('className="px-4 py-4 text-right font-black text-indigo-700 pr-8 text-base"', 'className="px-3 py-2 text-right font-black text-indigo-700 pr-8 text-sm"')


with open("src/pages/Orcamentos.jsx", "w", encoding="utf-8") as f:
    f.write(text)
print("Spreadsheet replaced")
