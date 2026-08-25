import sys
import re

with open('src/pages/WhatsAppChat.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Fix filteredChats
old_filter = '''    // 1ª Linha: Filtros de Categoria (Aguardando / Todas / Fim)
    let matchesTab = true;
    if (filterTab === 'aguardando') {
      matchesTab = chat.status === 'aguardando_atendente' || chat.status === 'triagem' || !chat.status;
    } else if (filterTab === 'finalizados') {
      matchesTab = chat.status === 'finalizado';
    }

    if (!matchesTab) return false;

    // 2ª Linha: Sub-Filtros de Atendimento (Em Atendimento / Aguardando Retorno / Finalizadas)
    if (subFilter === 'em_atendimento' && chat.status !== 'em_atendimento') {
      return false;
    }
    if (subFilter === 'aguardando_retorno' && chat.status !== 'aguardando_retorno') {
      return false;
    }
    if (subFilter === 'finalizado' && chat.status !== 'finalizado') {
      return false;
    }

    // 3ª Linha: Atendentes
    if (attendantFilter !== 'todos') {
      if (chat.assigned_to !== attendantFilter) return false;
    }

    return true;'''

new_filter = '''    // 1ª Linha: Filtros de Categoria (Aguardando / Todas / Fim)
    if (filterTab === 'aguardando') {
      // Ignora sub-filtros de status, pois devem estar obrigatoriamente aguardando
      if (chat.status !== 'aguardando_atendente' && chat.status !== 'triagem' && chat.status) return false;
    } else if (filterTab === 'finalizados') {
      if (chat.status !== 'finalizado') return false;
      // 3ª Linha: Atendentes (aplica em Fim)
      if (attendantFilter !== 'todos' && chat.assigned_to !== attendantFilter) return false;
    } else {
      // filterTab === 'todas'
      // 2ª Linha: Sub-Filtros de Atendimento
      if (subFilter === 'em_atendimento' && chat.status !== 'em_atendimento') return false;
      if (subFilter === 'aguardando_retorno' && chat.status !== 'aguardando_retorno') return false;
      if (subFilter === 'finalizado' && chat.status !== 'finalizado') return false;

      // 3ª Linha: Atendentes
      if (attendantFilter !== 'todos' && chat.assigned_to !== attendantFilter) return false;
    }

    return true;'''

if old_filter not in code:
    print('Failed to find old filter block!')
    sys.exit(1)
code = code.replace(old_filter, new_filter)


# 2. Fix Modal Header
old_header = '''              <button
                onClick={() => { setTransferModalOpen(false); setTransferTab('setor'); }}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >'''

new_header = '''              <button
                onClick={() => setTransferModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >'''
if old_header not in code:
    print('Failed to find old header!')
    sys.exit(1)
code = code.replace(old_header, new_header)

# 3. Fix Modal Tabs and Lists
match = re.search(r'            \{\/\* Tabs \*\/\}.*?            \{\/\* Tab: Atendente \*\/\}\s*\{transferTab === \'usuario\' && \(\s*<div className=\"space-y-2\">', code, re.DOTALL)
if not match:
    print('Failed to find tabs!')
    sys.exit(1)

code = code.replace(match.group(0), '            {/* Listagem de Usuários */}\n            <div className=\"space-y-2\">')

# Remove the ')}' at the end of the modal for the tab condition
match2 = re.search(r'              \{\(!usersList \|\| usersList\.length === 0\) && \(\s*<p className=\"text-xs text-gray-400 text-center py-4\">Nenhum usuário cadastrado no sistema\.</p>\s*\)\}\s*</div>\s*\)\}\s*</div>\s*</div>\s*\)\}\s*</div>', code, re.DOTALL)
if not match2:
    print('Failed to find end of modal!')
    sys.exit(1)

code = code.replace(match2.group(0), '''              {(!usersList || usersList.length === 0) && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhum usuário cadastrado no sistema.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>''')

with open('src/pages/WhatsAppChat.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
print('Success!')
