function showFeedback(message, elementId) {
    const feedbackEl = document.getElementById(elementId);
    if (feedbackEl) {
        feedbackEl.textContent = message;
        feedbackEl.style.display = 'block';
        feedbackEl.classList.remove('text-red-500'); // Garante que a cor padrão seja usada
        feedbackEl.classList.add('text-green-500'); // Cor verde para sucesso
        setTimeout(() => {
            feedbackEl.style.display = 'none';
        }, 3000); // Esconde a mensagem após 3 segundos
    }
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

document.getElementById('add-box-btn').addEventListener('click', () => {
    document.getElementById('box-form').reset();
    document.getElementById('box-id').value = '';
    showModal('box-form-modal');
});

document.getElementById('add-origin-btn').addEventListener('click', () => {
    document.getElementById('origin-form-full').reset();
    document.getElementById('origin-id-full').value = '';
    showModal('origin-form-modal');
});

const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return 'R$ 0,00';
    return `R$ ${value.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.')}`;
};

const formatValueInput = (input) => {
    let value = input.value.replace(/\D/g, '');
    if (!value) { input.value = ''; return; }
    const number = parseInt(value, 10);
    input.value = (number / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

let STATE = { origins: [], boxes: [], balances: [], debts: [], currentMonth: new Date().getMonth()+1, currentYear: new Date().getFullYear(), selectedOriginFilter: 'all' };


async function apiGet(path){ const res = await fetch(path); if(!res.ok) throw new Error(`GET ${path} failed: ${res.status}`); return res.json(); }
async function apiPost(path, body){ return fetch(path, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) }); }
async function apiPut(path, body){ return fetch(path, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) }); }
async function apiDelete(path){ return fetch(path, { method:'DELETE' }); }


function showConfirmModal(message, callback) {
    const modal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmYes = document.getElementById('confirm-yes');
    const confirmNo = document.getElementById('confirm-no');

    confirmMessage.textContent = message;

    confirmYes.onclick = () => {
        callback(true);
        modal.classList.remove('show');
    };

    confirmNo.onclick = () => {
        callback(false);
        modal.classList.remove('show');
    };

    modal.classList.add('show');
}

async function loadAll(){
    try{
        const [origins, boxes, dashboard] = await Promise.all([ apiGet('https://controle-gastos-backend-9rox.onrender.com/api/origens'), apiGet('https://controle-gastos-backend-9rox.onrender.com/api/caixas'), apiGet('https://controle-gastos-backend-9rox.onrender.com/api/dashboard') ]);
        STATE.origins = origins; STATE.boxes = boxes; STATE.balances = dashboard.saldos || []; STATE.debts = dashboard.dividas || [];
        renderPrincipalPage(); renderOriginsTable(); renderBoxesTable(); populateFormSelects(); populateFilters();
    }catch(err){ console.error(err); alert('Erro ao carregar dados do backend. Verifique se o Flask está rodando.'); }
}

// No seu arquivo <script>

// ... dentro da função populateFilters() ...

// Adicione esta nova função para inicializar o Flatpickr corretamente
function populateFilters(){  
    // Dentro da sua função populateFilters()
    flatpickr("#date-filter", {
        // Certifique-se de que a propriedade 'plugins' esteja presente
        plugins: [
            new monthSelectPlugin({
                shorthand: false, // exibe 'Jan' em vez de 'Janeiro'
                dateFormat: "F \\d\\e Y",
                altFormat: "F Y",
                theme: "dark"
            })
        ],
        // 'locale' para traduzir os meses para português
        locale: "pt",
        disableMobile: "true",
        defaultDate: new Date(STATE.currentYear, STATE.currentMonth - 1),
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length > 0) {
                const selectedDate = selectedDates[0];
                STATE.currentMonth = selectedDate.getMonth() + 1;
                STATE.currentYear = selectedDate.getFullYear();
                renderPrincipalPage();
            }
        }
    });
    const filterOriginSelect = document.getElementById('filter-origin');
    filterOriginSelect.innerHTML = '<option value="all">Todas as Origens</option>';
    STATE.origins.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.descricao;
        filterOriginSelect.appendChild(opt);
    });
    filterOriginSelect.addEventListener('change', (e) => {
        STATE.selectedOriginFilter = e.target.value;
        renderPrincipalPage();
    });


}

function calculateSummaryTotals(balances, debts){
    const originTotals = new Map();
    // Usa `filter` para garantir que apenas os itens que correspondem ao filtro de origem sejam processados
    const originsToProcess = STATE.selectedOriginFilter === 'all' 
        ? STATE.origins 
        : STATE.origins.filter(o => o.id == STATE.selectedOriginFilter);

    originsToProcess.forEach(origin => {
        // Inicializa apenas se houver pelo menos um item relacionado a essa origem
        originTotals.set(origin.id, { totalBalance:0, totalDebt:0, finalBalance:0, color: origin.cor, description: origin.descricao });
    });
    
    balances.forEach(b => {
        const box = STATE.boxes.find(x => x.id === b.caixa_id);
        if(box && originTotals.has(box.origem_id)) {
            const t = originTotals.get(box.origem_id);
            if(t) t.totalBalance += b.valor;
        }
    });

    debts.forEach(d => {
        const box = STATE.boxes.find(x => x.id === d.caixa_id);
        if(box && originTotals.has(box.origem_id)) {
            const t = originTotals.get(box.origem_id);
            if(t) t.totalDebt += d.valor;
        }
    });

    // FILTRO APLICADO AQUI: Remove origens que não têm saldos ou dívidas
    const filteredOriginTotals = new Map();
    originTotals.forEach((v, k) => {
        if (v.totalBalance > 0 || v.totalDebt > 0) {
            v.finalBalance = v.totalBalance - v.totalDebt;
            filteredOriginTotals.set(k, v);
        }
    });

    return filteredOriginTotals;
}

function renderSummaryTotals(originTotals) {
    const container = document.getElementById('summary-cards');
    const existingCardElements = container.querySelectorAll('.summary-card');
    const existingCardMap = new Map();

    // 1. Mapeia os cards existentes no DOM
    existingCardElements.forEach(card => {
        const id = card.dataset.originId;
        existingCardMap.set(id, card);
    });

    // 2. Remove os cards que não estão mais no conjunto de dados
    existingCardMap.forEach((card, id) => {
        if (!originTotals.has(parseInt(id))) {
            card.classList.add('card-disappearing');
            setTimeout(() => card.remove(), 400);
        }
    });

    // 3. Adiciona ou atualiza os cards necessários
    originTotals.forEach((total, id) => {
        let card = existingCardMap.get(String(id));

        if (card) {
            // Card já existe, apenas atualiza o conteúdo
            card.querySelector('h4').textContent = total.description;
            card.querySelector('span[style]').style.backgroundColor = total.color;
            card.querySelectorAll('p span')[0].textContent = formatCurrency(total.totalBalance);
            card.querySelectorAll('p span')[1].textContent = formatCurrency(total.totalDebt);
            const finalBalanceSpan = card.querySelectorAll('p span')[2];
            finalBalanceSpan.textContent = formatCurrency(total.finalBalance);
            finalBalanceSpan.className = total.finalBalance >= 0 ? 'text-green-500' : 'text-red-500';
        } else {
            // Card não existe, cria um novo
            card = document.createElement('div');
            card.classList.add('summary-card', 'card-appearing');
            card.style = (`background-color: ${total.color}`);
            card.dataset.originId = id;

            card.innerHTML = `
                <div class="flex items-center space-x-4 mb-8" >
                    
                    <h4 style="font-size: 35px;" class="text-lg md:text-xl font-bold text-white">${total.description}</h4>
                </div>
                <div class="space-y-2">
                    <p style="font-size: 20px;"class="text-xs md:text-sm">Saldo Total: <span class="font-semibold text-green-400">${formatCurrency(total.totalBalance)}</span></p>
                    <p style="font-size: 20px; margin-top:10px"class="text-xs md:text-sm mb-5">Total a Pagar: <span class="font-semibold text-red-400">${formatCurrency(total.totalDebt)}</span></p>
                    <p style="font-size: 25px; margin-top:20px"class="text-base md:text-lg font-bold">Saldo Final: <span style=" color:${total.finalBalance >= 0 ? '#b4fdfa' : '#fdb4b4ff'}">${formatCurrency(total.finalBalance)}</span></p>
                </div>
            `;
            container.appendChild(card);

            // Remove a classe de animação após o tempo para re-renderizações futuras
            setTimeout(() => card.classList.remove('card-appearing'), 400);
        }
    });

    // 4. Lida com a mensagem de "nenhum resumo"
    if (originTotals.size === 0 && container.children.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400">Nenhum resumo encontrado. Cadastre origens e caixas para começar.</p>';
    } else if (originTotals.size > 0 && container.querySelector('p.text-center')) {
        container.querySelector('p.text-center').remove();
    }
}   
function renderPrincipalTables(balances, debts) {
    const balancesBody = document.getElementById('balances-table-body');
    const debtsBody = document.getElementById('debts-table-body');
    balancesBody.innerHTML = '';
    debtsBody.innerHTML = '';
    if (!balances || balances.length === 0) document.getElementById('balances-empty-message').style.display = 'block';
    else document.getElementById('balances-empty-message').style.display = 'none';
    if (!debts || debts.length === 0) document.getElementById('debts-empty-message').style.display = 'block';
    else document.getElementById('debts-empty-message').style.display = 'none';
    balances.forEach(b => {
        const box = STATE.boxes.find(x => x.id === b.caixa_id) || {};
        const origin = STATE.origins.find(o => o.id === box.origem_id);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-600';
        tr.style = `background-color:${origin?origin.cor:'#ccc'}`;
        tr.innerHTML = `<td class="px-4 py-2">${b.descricao}</td><td class="px-4 py-2"> ${origin?origin.descricao:'N/A'}</td><td class="px-4 py-2 text-right">${formatCurrency(b.valor)}</td><td class="px-4 py-2 text-right"><button data-id="${b.id}" class="edit-balance-btn material-symbols-outlined edit-icon icon-button ">edit</button> <button data-id="${b.id}" class="delete-balance-btn material-symbols-outlined delete-icon icon-button ">delete</button></td>`;
        balancesBody.appendChild(tr);
    });
    debts.forEach(d => {
        const box = STATE.boxes.find(x => x.id === d.caixa_id) || {};
        const origin = STATE.origins.find(o => o.id === box.origem_id);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-600';
        tr.style = `background-color:${origin?origin.cor:'#ccc'}`;
        tr.innerHTML = `<td class="px-4 py-2">${d.descricao}</td><td class="px-4 py-2"> ${origin?origin.descricao:'N/A'}</td><td class="px-4 py-2 text-right">${formatCurrency(d.valor)}</td><td class="px-4 py-2 text-right"><button data-id="${d.id}" class="edit-debt-btn material-symbols-outlined edit-icon icon-button">edit</button> <button data-id="${d.id}" class="delete-debt-btn material-symbols-outlined delete-icon icon-button">delete</button></td>`;
        debtsBody.appendChild(tr);
    });
}

function renderPrincipalPage(){
    const filteredBalances = STATE.balances.filter(b => {
        const isMonth = STATE.currentMonth == 'all' || b.mes == STATE.currentMonth;
        const isYear = STATE.currentYear == 'all' || b.ano == STATE.currentYear;
        const originId = (STATE.boxes.find(x => x.id === b.caixa_id) || {}).origem_id;
        // CORREÇÃO: Usado '==' para comparar o ID da origem com o valor do filtro
        const isOrigin = STATE.selectedOriginFilter == 'all' || originId == STATE.selectedOriginFilter;
        return isMonth && isYear && isOrigin;
    });
    const filteredDebts = STATE.debts.filter(d => {
        const isMonth = STATE.currentMonth == 'all' || d.mes == STATE.currentMonth;
        const isYear = STATE.currentYear == 'all' || d.ano == STATE.currentYear;
        const originId = (STATE.boxes.find(x => x.id === d.caixa_id) || {}).origem_id;
        // CORREÇÃO: Usado '==' para comparar o ID da origem com o valor do filtro
        const isOrigin = STATE.selectedOriginFilter == 'all' || originId == STATE.selectedOriginFilter;
        return isMonth && isYear && isOrigin;
    });
    const originTotals = calculateSummaryTotals(filteredBalances, filteredDebts);
    renderSummaryTotals(originTotals);
    renderPrincipalTables(filteredBalances, filteredDebts);
}
async function renderOriginsTable(){ const tbody=document.getElementById('origins-table-body'); tbody.innerHTML=''; STATE.origins.forEach(o=>{ const tr=document.createElement('tr'); tr.innerHTML = `<td class="px-6 py-4">${o.descricao}</td><td class="px-6 py-4"><span class="table-row-color" style="background:${o.cor}"></span></td><td class="px-6 py-4 text-right"><button data-id="${o.id}" class="edit-origin-btn material-symbols-outlined edit-icon icon-button ">edit</button> <button data-id="${o.id}" class="delete-origin-btn material-symbols-outlined delete-icon icon-button ">delete</button></td>`; tbody.appendChild(tr); }); }

document.getElementById('origin-form-full').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const form=e.target;
    const id=form['origin-id-full'].value;
    const descricao=form['origin-description'].value;
    const cor=form['origin-color-full'].value;
    const data={descricao, cor};
    
    let message;
    if(id){
        await apiPut(`/api/origens/${id}`, data);
        message = 'Origem editada com sucesso!';
    }else{
        await apiPost('/api/origens', data);
        message = 'Origem cadastrada com sucesso!';
    }
    
    hideModal('origin-form-modal');
    await reloadOriginsAndBoxes();
    showFeedback(message, 'feedback-message');
});

    document.getElementById('origin-cancel-button').addEventListener('click', ()=>{ document.getElementById('origin-form-full').reset(); document.getElementById('origin-id-full').value=''; hideModal('origin-form-modal');});

document.addEventListener('click', async (e)=>{ if(e.target.classList.contains('edit-origin-btn')){ const id=e.target.dataset.id; const origin = STATE.origins.find(o=>o.id==id); if(origin){ document.getElementById('origin-id-full').value=origin.id; document.getElementById('origin-description').value=origin.descricao; document.getElementById('origin-color-full').value=origin.cor;
    showModal('origin-form-modal'); 
    //  showPage('origem');
 } } if(e.target.classList.contains('delete-origin-btn')){ const id=e.target.dataset.id; showConfirmModal('Tem certeza que deseja excluir esta origem?', async (confirmed) => {if (confirmed) {await apiDelete(`/api/origens/${id}`);await reloadOriginsAndBoxes();}});}});

async function renderBoxesTable(){ const tbody=document.getElementById('boxes-table-body'); tbody.innerHTML=''; STATE.boxes.forEach(b=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td class="px-6 py-4">${b.descricao}</td><td class="px-6 py-4">${b.origem_descricao || 'N/A'}</td><td class="px-6 py-4 text-right"><button data-id="${b.id}" class="edit-box-btn material-symbols-outlined edit-icon icon-button ">edit</button> <button data-id="${b.id}" class="delete-box-btn material-symbols-outlined delete-icon icon-button ">delete</button></td>`; tbody.appendChild(tr); }); }

document.getElementById('box-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const form = e.target;
    const id=form['box-id'].value;
    const descricao=form['box-description'].value;
    const origemId=form['box-origin'].value;
    const data={descricao, origemId};
    
    let message;
    if(id){
        await apiPut(`/api/caixas/${id}`, data);
        message = 'Caixa editada com sucesso!';
    }else{
        await apiPost('/api/caixas', data);
        message = 'Caixa cadastrada com sucesso!';
    }
    
    hideModal('box-form-modal');
    await reloadOriginsAndBoxes();
    showFeedback(message, 'box-feedback-message');
});
document.getElementById('box-cancel-button').addEventListener('click', ()=>{ document.getElementById('box-form').reset(); document.getElementById('box-id').value='';hideModal('box-form-modal'); });

document.addEventListener('click', async (e)=>{
    if(e.target.classList.contains('edit-box-btn')){ 
        const id=e.target.dataset.id; 
        const box = STATE.boxes.find(x=>x.id==id); 
        if(box){ 
            document.getElementById('box-id').value=box.id; 
            document.getElementById('box-description').value=box.descricao; 
            document.getElementById('box-origin').value=box.origem_id || ''; 
            showModal('box-form-modal'); 
            showPage('caixa'); 
        } 
    } 
    if(e.target.classList.contains('delete-box-btn')){
        const id=e.target.dataset.id;
        showConfirmModal('Tem certeza que deseja excluir esta caixa?', async (confirmed) => {
        if (confirmed) {
            await apiDelete(`/api/caixas/${id}`);
            await reloadOriginsAndBoxes();
        }
    });
} });

document.getElementById('balance-form').addEventListener('submit', async e=>{ e.preventDefault(); const id=document.getElementById('balance-id').value; const descricao=document.getElementById('balance-description').value; const caixa_id=document.getElementById('balance-box').value; const mes=parseInt(document.getElementById('balance-month').value); const ano=parseInt(document.getElementById('balance-year').value); const raw=document.getElementById('balance-value').value.replace(/\./g,'').replace(',','.'); const valor=parseFloat(raw);
const payload={ descricao, caixa_id, mes, ano, valor };
if(id){ await apiPut(`/api/saldos/${id}`, payload); } else { await apiPost('/api/saldos', payload); }
document.getElementById('balance-form').reset(); document.getElementById('balance-id').value=''; await reloadDashboard(); });

document.getElementById('balance-cancel-button').addEventListener('click', ()=>{ 
    //document.getElementById('balance-form').reset(); 
    document.getElementById('balance-id').value=''; 
    showPage('principal'); // Adiciona esta linha para redirecionar para a página principal
});

document.addEventListener('click', async (e)=>{ if(e.target.classList.contains('edit-balance-btn')){ const id=e.target.dataset.id; const bal = STATE.balances.find(x=>x.id==id); if(bal){ document.getElementById('balance-id').value=bal.id; document.getElementById('balance-description').value=bal.descricao; document.getElementById('balance-box').value=bal.caixa_id; document.getElementById('balance-month').value=bal.mes; document.getElementById('balance-year').value=bal.ano; document.getElementById('balance-value').value=(bal.valor).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}); showPage('saldo'); } } if(e.target.classList.contains('delete-balance-btn')){
    const id=e.target.dataset.id;
    showConfirmModal('Tem certeza que deseja excluir este saldo?', async (confirmed) => {
        if (confirmed) {
            await apiDelete(`/api/saldos/${id}`);
            await reloadDashboard();
        }
    });
}});

document.getElementById('debt-form').addEventListener('submit', async e=>{ e.preventDefault(); const id=document.getElementById('debt-id').value; const descricao=document.getElementById('debt-description').value; const caixa_id=document.getElementById('debt-origin').value; const mes=parseInt(document.getElementById('debt-month').value); const ano=parseInt(document.getElementById('debt-year').value); const raw=document.getElementById('debt-value').value.replace(/\./g,'').replace(',','.'); const valor=parseFloat(raw); const payload={ descricao, caixa_id, mes, ano, valor };
if(id){ await apiPut(`/api/dividas/${id}`, payload); } else { await apiPost('/api/dividas', payload); }
document.getElementById('debt-form').reset(); document.getElementById('debt-id').value=''; await reloadDashboard(); });

document.getElementById('debt-cancel-button').addEventListener('click', ()=>{ 
    //document.getElementById('balance-form').reset(); 
    document.getElementById('balance-id').value=''; 
    showPage('principal'); // Adiciona esta linha para redirecionar para a página principal
});

document.addEventListener('click', async (e)=>{ if(e.target.classList.contains('edit-debt-btn')){ const id=e.target.dataset.id; const debt = STATE.debts.find(x=>x.id==id); if(debt){ document.getElementById('debt-id').value=debt.id; document.getElementById('debt-description').value=debt.descricao; document.getElementById('debt-origin').value=debt.caixa_id; document.getElementById('debt-month').value=debt.mes; document.getElementById('debt-year').value=debt.ano; document.getElementById('debt-value').value=(debt.valor).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}); showPage('divida'); } } 
if(e.target.classList.contains('delete-debt-btn')){
    const id=e.target.dataset.id;
    showConfirmModal('Tem certeza que deseja excluir esta dívida?', async (confirmed) => {
        if (confirmed) {
            await apiDelete(`/api/dividas/${id}`);
            await reloadDashboard();
        }
    });
}

});

async function reloadDashboard(){ const dash = await apiGet('/api/dashboard'); STATE.balances = dash.saldos || []; STATE.debts = dash.dividas || []; renderPrincipalPage(); }
async function populateFormSelects(){ STATE.origins = await apiGet('/api/origens'); STATE.boxes = await apiGet('/api/caixas'); const balanceBox = document.getElementById('balance-box'); balanceBox.innerHTML='<option value="">Selecione um caixa</option>'; STATE.boxes.forEach(b=>{ const opt=document.createElement('option'); opt.value=b.id; opt.textContent=`${b.origem_descricao || ''}`; balanceBox.appendChild(opt); }); const debtOrigin = document.getElementById('debt-origin'); debtOrigin.innerHTML='<option value="">Selecione um caixa</option>'; STATE.boxes.forEach(b=>{ const opt=document.createElement('option'); opt.value=b.id; opt.textContent=`${b.descricao} (${b.origem_descricao || ''})`; debtOrigin.appendChild(opt); }); const boxOrigin = document.getElementById('box-origin'); boxOrigin.innerHTML='<option value="">Selecione uma origem</option>'; STATE.origins.forEach(o=>{ const opt=document.createElement('option'); opt.value=o.id; opt.textContent=o.descricao; boxOrigin.appendChild(opt); }); }

async function reloadOriginsAndBoxes(){ STATE.origins = await apiGet('/api/origens'); STATE.boxes = await apiGet('/api/caixas'); renderOriginsTable(); renderBoxesTable(); populateFormSelects(); populateFilters(); }

const pageContents = document.querySelectorAll('.page-content'); const navLinks = document.querySelectorAll('.nav-link'); function showPage(id){ pageContents.forEach(p=>p.classList.remove('active')); const el=document.getElementById(id); if(el) el.classList.add('active'); navLinks.forEach(link=>{ link.classList.remove('bg-gray-700'); if(link.getAttribute('href').substring(1)===id) link.classList.add('bg-gray-700'); }); window.location.hash=id; }
navLinks.forEach(link=> link.addEventListener('click',(e)=>{ e.preventDefault(); showPage(link.getAttribute('href').substring(1)); }));

function initMonthYearSelects(){
    const currentMonth=new Date().getMonth()+1;
    const currentYear=new Date().getFullYear();
    ['balance-month','debt-month'].forEach(id=>{
        const sel=document.getElementById(id);
        sel.innerHTML='';
        for(let i=1;i<=12;i++){
            const opt=document.createElement('option');
            opt.value=i;
            opt.textContent=String(i).padStart(2,'0');
            if(i===currentMonth) opt.selected=true;
            sel.appendChild(opt);
        }
    });
    ['balance-year','debt-year'].forEach(id=>{
        const sel=document.getElementById(id);
        sel.innerHTML='';
        for(let y=currentYear-5;y<=currentYear+5;y++){
            const opt=document.createElement('option');
            opt.value=y;
            opt.textContent=y;
            if(y===currentYear) opt.selected=true;
            sel.appendChild(opt);
        }
    });
}

window.addEventListener('load', async ()=>{ initMonthYearSelects(); await loadAll(); });

document.addEventListener('DOMContentLoaded', () => {
    const hamburgerButton = document.getElementById('hamburger-button');
    const collapseButton = document.getElementById('collapse-button');
    const sidebar = document.getElementById('sidebar-menu');
    const overlay = document.getElementById('overlay');
    const navLinks = document.querySelectorAll('.nav-link');

    // Função para fechar o menu no mobile
    const closeMobileMenu = () => {
        sidebar.classList.remove('open');
        overlay.classList.add('hidden');
        
    };

    // Evento para abrir/fechar o menu ao clicar no botão de hambúrguer (mobile)
    hamburgerButton.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('hidden');
    });

    // Evento para colapsar/expandir o menu em telas grandes
    if (collapseButton) {
        collapseButton.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            
        });
    }

    // Evento para fechar o menu ao clicar no overlay
    if (overlay) {
        overlay.addEventListener('click', closeMobileMenu);
    }
    
    // Evento para fechar o menu ao clicar em um link (no mobile)
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                closeMobileMenu();
            }
        });
    });

    // Lógica para alternar a exibição do botão de colapsar e o comportamento do menu
    const updateMenuButtons = () => {
        if (window.innerWidth >= 768) {
            if (collapseButton) collapseButton.style.display = 'block'; 
            if (hamburgerButton) hamburgerButton.style.display = 'none'; 
            sidebar.classList.remove('open'); 
            if (overlay) { 
                overlay.classList.add('hidden'); 
            } 
        } else { 
            if (collapseButton) collapseButton.style.display = 'none'; 
            if (hamburgerButton) hamburgerButton.style.display = 'block'; 
            sidebar.classList.remove('collapsed'); 
        } 
    };
    
    window.addEventListener('resize', updateMenuButtons);
    updateMenuButtons();

    // ... (O restante do seu código JavaScript, como os listeners de formulário)
});
