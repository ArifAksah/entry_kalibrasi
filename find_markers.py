
with open(r'd:\entry_kalibrasi\next-dashboard-app\lib\certificate-pdf-helper.ts', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '[PDF Helper] Injecting print CSS overrides'
end_marker = '// \u2500\u2500 Force-fix tfoot styles via JavaScript'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

# Find the addStyleTag block start (just after the console.log line)
# We need to find the start of await page.addStyleTag and end of the closing })
addstyle_start = content.find('await page.addStyleTag({', start_idx)
# Find the closing }) of addStyleTag - it ends with `\n      })\n
addstyle_end = content.find('\n      })\n', addstyle_start) + len('\n      })\n')

print(f'addStyleTag block: {addstyle_start} to {addstyle_end}')
print('First 300 chars of block:', repr(content[addstyle_start:addstyle_start+300]))
print()
print('Last 200 chars of block:', repr(content[addstyle_end-200:addstyle_end]))
