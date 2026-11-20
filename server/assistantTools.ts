import { Type } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';

export const ASSISTANT_SYSTEM_INSTRUCTION = `Você é o Assistente Operacional e Consultor Financeiro Autônomo integrado ao Vértice Finance — sendo a tela principal e o centro de comando do sistema nas distribuições Web, Linux, Windows e Android.
Seu papel é analisar profundamente as finanças do usuário e agir de forma autônoma em todo o sistema, executando ajustes, inserções, edições, acréscimos, conciliações, planejamentos, filtros, exportações, trocas de moeda/tema, abertura de configurações ou downloads e exclusões que atenderem ao objetivo explicado pelo usuário — sem fazê-lo navegar por menus.

Diretrizes fundamentais:
1. Idioma e tom: Responda sempre em português do Brasil (pt-BR), com clareza, objetividade e postura consultiva proativa.
2. Precisão numérica: Use EXCLUSIVAMENTE os números, contas, categorias, metas, orçamentos e lançamentos reais presentes no contexto ou retornados pelas ferramentas de consulta. Nunca invente valores ou IDs.
3. Execução autônoma em vez de delegar ao usuário:
   - Quando o usuário descrever um objetivo ou situação (ex.: "organize minhas contas pendentes", "lance meu salário e contas fixas deste mês", "pague a fatura do cartão", "ajuste os orçamentos que estouraram", "remova os lançamentos de teste", "crie uma meta para minha viagem e já faça o primeiro aporte", "mude para modo escuro", "altere a moeda para USD", "abra a aba de downloads"), DECIDA e EXECUTE diretamente as ações pertinentes usando as ferramentas.
   - Não peça para o usuário ir até uma aba clicar em botões quando você mesmo pode fazer a alteração pelo sistema.
   - Se o usuário pedir explicitamente para abrir ou pré-preencher um formulário na tela para revisar/completar antes de salvar (ex.: "preencha o formulário de nova conta", "abra a tela de lançamento preenchida com..."), use open_app_form.
   - Para imagens anexadas (notas fiscais, cupons, comprovantes PIX, faturas), extraia os dados (valor, descrição, data, tipo, categoria, conta provável) e já execute o lançamento (ou lote de lançamentos) automaticamente, informando o que foi registrado.
   - Antes de excluir ou alterar múltiplos registros com base em critério amplo, use search_transactions / get_* primeiro para confirmar exatamente quais IDs correspondem e então execute com precisão, listando claramente na resposta final tudo o que foi feito, ajustado, inserido ou removido.
4. Formatação: Estruture respostas com tópicos objetivos, resumo do que foi executado e valores formatados (ex.: R$ 1.250,00).`;

export const ASSISTANT_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'get_period_analysis',
    description:
      'Calcula receitas, despesas, saldo líquido, taxa de poupança, gastos por categoria, contas pendentes e comparativo mensal para um mês ou intervalo de meses.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        month: {
          type: Type.STRING,
          description: 'Mês alvo no formato YYYY-MM. Se omitido, usa o mês selecionado.',
        },
        compareMonths: {
          type: Type.INTEGER,
          description: 'Quantidade de meses anteriores para incluir na comparação (ex: 3 ou 6).',
        },
      },
    },
  },
  {
    name: 'search_transactions',
    description:
      'Busca e filtra lançamentos no extrato por texto, mês, tipo, status, categoria, conta ou faixa de valor.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Texto para buscar na descrição ou observações.',
        },
        month: {
          type: Type.STRING,
          description: 'Filtrar por mês YYYY-MM (opcional).',
        },
        type: {
          type: Type.STRING,
          description: 'Filtrar por tipo: income, expense ou transfer.',
        },
        status: {
          type: Type.STRING,
          description: 'Filtrar por status: paid ou pending.',
        },
        categoryId: {
          type: Type.STRING,
          description: 'ID ou nome da categoria para filtrar.',
        },
        accountId: {
          type: Type.STRING,
          description: 'ID ou nome da conta/cartão para filtrar.',
        },
        minAmount: {
          type: Type.NUMBER,
          description: 'Valor mínimo do lançamento.',
        },
        maxAmount: {
          type: Type.NUMBER,
          description: 'Valor máximo do lançamento.',
        },
        limit: {
          type: Type.INTEGER,
          description: 'Máximo de resultados (padrão 35).',
        },
      },
    },
  },
  {
    name: 'get_accounts_and_cards_status',
    description:
      'Retorna detalhamento completo de todas as contas bancárias, carteiras, investimentos e cartões de crédito (saldo, limite total, utilizado, disponível, fechamento e vencimento).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        includeArchived: {
          type: Type.BOOLEAN,
          description: 'Se true, inclui contas arquivadas.',
        },
      },
    },
  },
  {
    name: 'get_budgets_and_goals_status',
    description:
      'Retorna o progresso dos orçamentos mensais por categoria e o andamento de todas as metas financeiras com cálculo de aporte mensal necessário até o prazo.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        month: {
          type: Type.STRING,
          description: 'Mês YYYY-MM para os orçamentos (padrão: mês selecionado).',
        },
      },
    },
  },
  {
    name: 'create_transaction',
    description:
      'Registra uma nova receita, despesa ou transferência (suporta parcelamento e recorrência) e atualiza saldos automaticamente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          description: 'Tipo: income (receita), expense (despesa) ou transfer (transferência).',
        },
        amount: {
          type: Type.NUMBER,
          description: 'Valor positivo da transação (ou valor de cada parcela se parcelado).',
        },
        description: {
          type: Type.STRING,
          description: 'Descrição clara do lançamento.',
        },
        categoryId: {
          type: Type.STRING,
          description: 'ID ou nome da categoria (para income ou expense). Para transfer, use "transfer".',
        },
        accountId: {
          type: Type.STRING,
          description: 'ID ou nome da conta ou cartão de origem.',
        },
        toAccountId: {
          type: Type.STRING,
          description: 'ID ou nome da conta de destino (obrigatório quando type = transfer).',
        },
        date: {
          type: Type.STRING,
          description: 'Data no formato YYYY-MM-DD (padrão: hoje).',
        },
        status: {
          type: Type.STRING,
          description: 'paid (efetivado) ou pending (pendente). Padrão: paid.',
        },
        installments: {
          type: Type.INTEGER,
          description: 'Número de parcelas (1 para à vista, >1 para parcelado).',
        },
        isRecurring: {
          type: Type.BOOLEAN,
          description: 'Se é um lançamento recorrente.',
        },
        recurrenceFrequency: {
          type: Type.STRING,
          description: 'Frequência: none, monthly, weekly ou yearly.',
        },
        notes: {
          type: Type.STRING,
          description: 'Observações opcionais.',
        },
      },
      required: ['type', 'amount', 'description'],
    },
  },
  {
    name: 'bulk_create_transactions',
    description:
      'Cria vários lançamentos (receitas, despesas ou transferências) de uma única vez em operação atômica.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        items: {
          type: Type.ARRAY,
          description: 'Lista de lançamentos a criar.',
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, description: 'income, expense ou transfer.' },
              amount: { type: Type.NUMBER },
              description: { type: Type.STRING },
              categoryId: { type: Type.STRING },
              accountId: { type: Type.STRING },
              toAccountId: { type: Type.STRING },
              date: { type: Type.STRING, description: 'YYYY-MM-DD' },
              status: { type: Type.STRING, description: 'paid ou pending' },
              installments: { type: Type.INTEGER },
              isRecurring: { type: Type.BOOLEAN },
              recurrenceFrequency: { type: Type.STRING },
              notes: { type: Type.STRING },
            },
            required: ['type', 'amount', 'description'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'update_transaction',
    description:
      'Atualiza um lançamento existente pelo transactionId e recalcula os saldos das contas envolvidas.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        transactionId: { type: Type.STRING, description: 'ID do lançamento a atualizar.' },
        type: { type: Type.STRING, description: 'income, expense ou transfer.' },
        amount: { type: Type.NUMBER, description: 'Novo valor.' },
        description: { type: Type.STRING, description: 'Nova descrição.' },
        categoryId: { type: Type.STRING, description: 'Novo ID ou nome de categoria.' },
        accountId: { type: Type.STRING, description: 'Novo ID ou nome de conta.' },
        toAccountId: { type: Type.STRING, description: 'Novo ID ou nome de conta destino.' },
        date: { type: Type.STRING, description: 'Nova data YYYY-MM-DD.' },
        status: { type: Type.STRING, description: 'paid ou pending.' },
        isRecurring: { type: Type.BOOLEAN, description: 'Se é recorrente.' },
        recurrenceFrequency: { type: Type.STRING, description: 'none, monthly, weekly ou yearly.' },
        notes: { type: Type.STRING, description: 'Novas observações.' },
      },
      required: ['transactionId'],
    },
  },
  {
    name: 'bulk_update_transactions',
    description:
      'Atualiza vários lançamentos de uma só vez (ex.: efetivar todos os pendentes, reclassificar categoria em lote, ajustar datas ou valores).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        updates: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              transactionId: { type: Type.STRING },
              type: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              description: { type: Type.STRING },
              categoryId: { type: Type.STRING },
              accountId: { type: Type.STRING },
              toAccountId: { type: Type.STRING },
              date: { type: Type.STRING },
              status: { type: Type.STRING },
              isRecurring: { type: Type.BOOLEAN },
              recurrenceFrequency: { type: Type.STRING },
              notes: { type: Type.STRING },
            },
            required: ['transactionId'],
          },
        },
      },
      required: ['updates'],
    },
  },
  {
    name: 'toggle_transaction_status',
    description: 'Alterna o status de um lançamento entre efetivado (paid) e pendente (pending).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        transactionId: { type: Type.STRING, description: 'ID do lançamento.' },
      },
      required: ['transactionId'],
    },
  },
  {
    name: 'delete_transaction',
    description:
      'Exclui diretamente um lançamento pelo transactionId e estorna automaticamente seu impacto no saldo da conta.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        transactionId: { type: Type.STRING, description: 'ID do lançamento a excluir.' },
      },
      required: ['transactionId'],
    },
  },
  {
    name: 'bulk_delete_transactions',
    description:
      'Exclui múltiplos lançamentos de uma vez pelos IDs e estorna automaticamente todos os saldos envolvidos.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        transactionIds: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Lista de IDs de lançamentos a excluir.',
        },
      },
      required: ['transactionIds'],
    },
  },
  {
    name: 'create_account',
    description: 'Cria uma nova conta bancária, carteira, investimento ou cartão de crédito.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Nome da conta ou cartão.' },
        type: {
          type: Type.STRING,
          description: 'Tipo: checking, savings, wallet, investment ou credit.',
        },
        institution: { type: Type.STRING, description: 'Nome do banco ou instituição.' },
        balance: {
          type: Type.NUMBER,
          description: 'Saldo inicial (negativo para fatura em aberto no cartão de crédito).',
        },
        creditLimit: { type: Type.NUMBER, description: 'Limite do cartão (para type = credit).' },
        closingDay: { type: Type.INTEGER, description: 'Dia de fechamento da fatura (1-31).' },
        dueDay: { type: Type.INTEGER, description: 'Dia de vencimento da fatura (1-31).' },
        color: { type: Type.STRING, description: 'Cor hexadecimal (ex: #0F766E).' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'update_account',
    description: 'Edita os dados de uma conta ou cartão existente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountId: { type: Type.STRING, description: 'ID ou nome da conta a editar.' },
        name: { type: Type.STRING },
        type: { type: Type.STRING },
        institution: { type: Type.STRING },
        balance: { type: Type.NUMBER },
        creditLimit: { type: Type.NUMBER },
        closingDay: { type: Type.INTEGER },
        dueDay: { type: Type.INTEGER },
        color: { type: Type.STRING },
        archived: { type: Type.BOOLEAN },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'reconcile_account_balance',
    description:
      'Concilia o saldo de uma conta ou fatura de cartão para o valor real informado (targetBalance), podendo criar um lançamento de ajuste automático.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountId: { type: Type.STRING, description: 'ID ou nome da conta ou cartão.' },
        targetBalance: {
          type: Type.NUMBER,
          description: 'Saldo real desejado (negativo para dívida de cartão de crédito).',
        },
        createAdjustmentTransaction: {
          type: Type.BOOLEAN,
          description:
            'Se true (padrão), cria um lançamento de Ajuste/Conciliação pela diferença. Se false, atualiza o saldo diretamente.',
        },
        notes: { type: Type.STRING, description: 'Motivo do ajuste.' },
      },
      required: ['accountId', 'targetBalance'],
    },
  },
  {
    name: 'pay_credit_card_invoice',
    description:
      'Registra o pagamento (total ou parcial) da fatura de um cartão de crédito via transferência de uma conta bancária.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        cardAccountId: { type: Type.STRING, description: 'ID ou nome do cartão de crédito.' },
        fromAccountId: {
          type: Type.STRING,
          description: 'ID ou nome da conta pagadora (opcional; usa a conta corrente principal se omitida).',
        },
        amount: {
          type: Type.NUMBER,
          description: 'Valor a pagar (opcional; se omitido, paga o valor integral da fatura em aberto).',
        },
        date: { type: Type.STRING, description: 'Data YYYY-MM-DD (padrão: hoje).' },
      },
      required: ['cardAccountId'],
    },
  },
  {
    name: 'delete_account',
    description: 'Exclui diretamente uma conta ou cartão pelo ID ou nome.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountId: { type: Type.STRING, description: 'ID ou nome da conta a excluir.' },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'create_category',
    description: 'Cria uma nova categoria de receita ou despesa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Nome da categoria.' },
        type: { type: Type.STRING, description: 'income ou expense.' },
        icon: { type: Type.STRING, description: 'Nome de ícone Lucide (ex: Tag, Coffee, Car).' },
        color: { type: Type.STRING, description: 'Cor hexadecimal (ex: #0F766E).' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'update_category',
    description: 'Atualiza o nome, tipo, ícone ou cor de uma categoria existente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        categoryId: { type: Type.STRING, description: 'ID ou nome da categoria.' },
        name: { type: Type.STRING },
        type: { type: Type.STRING },
        icon: { type: Type.STRING },
        color: { type: Type.STRING },
      },
      required: ['categoryId'],
    },
  },
  {
    name: 'delete_category',
    description: 'Exclui diretamente uma categoria pelo ID ou nome.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        categoryId: { type: Type.STRING, description: 'ID ou nome da categoria.' },
      },
      required: ['categoryId'],
    },
  },
  {
    name: 'upsert_budget',
    description: 'Define ou atualiza o limite de orçamento mensal para uma categoria de despesa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        categoryId: { type: Type.STRING, description: 'ID ou nome da categoria de despesa.' },
        month: { type: Type.STRING, description: 'Mês no formato YYYY-MM (padrão: mês atual).' },
        amount: { type: Type.NUMBER, description: 'Valor limite mensal.' },
      },
      required: ['categoryId', 'amount'],
    },
  },
  {
    name: 'bulk_upsert_budgets',
    description:
      'Cria ou ajusta múltiplos orçamentos mensais de categorias em uma única operação atômica.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        month: { type: Type.STRING, description: 'Mês padrão YYYY-MM caso omitido nos itens.' },
        entries: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              categoryId: { type: Type.STRING, description: 'ID ou nome da categoria de despesa.' },
              month: { type: Type.STRING, description: 'Opcional YYYY-MM.' },
              amount: { type: Type.NUMBER, description: 'Novo valor limite.' },
            },
            required: ['categoryId', 'amount'],
          },
        },
      },
      required: ['entries'],
    },
  },
  {
    name: 'delete_budget',
    description: 'Exclui diretamente um orçamento mensal pelo ID.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        budgetId: { type: Type.STRING, description: 'ID do orçamento.' },
      },
      required: ['budgetId'],
    },
  },
  {
    name: 'copy_previous_month_budgets',
    description: 'Copia todos os orçamentos do mês anterior para o mês informado.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetMonth: {
          type: Type.STRING,
          description: 'Mês destino YYYY-MM (padrão: mês selecionado).',
        },
      },
    },
  },
  {
    name: 'create_goal',
    description: 'Cria uma nova meta financeira com valor alvo e prazo.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Nome da meta.' },
        targetAmount: { type: Type.NUMBER, description: 'Valor objetivo.' },
        currentAmount: { type: Type.NUMBER, description: 'Valor inicial já acumulado (padrão 0).' },
        deadline: { type: Type.STRING, description: 'Prazo final YYYY-MM-DD.' },
        color: { type: Type.STRING, description: 'Cor hexadecimal (ex: #0F766E).' },
      },
      required: ['name', 'targetAmount', 'deadline'],
    },
  },
  {
    name: 'update_goal',
    description: 'Atualiza os detalhes ou status de uma meta existente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        goalId: { type: Type.STRING, description: 'ID ou nome da meta.' },
        name: { type: Type.STRING },
        targetAmount: { type: Type.NUMBER },
        currentAmount: { type: Type.NUMBER },
        deadline: { type: Type.STRING },
        color: { type: Type.STRING },
        status: { type: Type.STRING, description: 'active, completed ou cancelled.' },
      },
      required: ['goalId'],
    },
  },
  {
    name: 'contribute_to_goal',
    description:
      'Registra um aporte em uma meta financeira, podendo opcionalmente debitar o valor de uma conta.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        goalId: { type: Type.STRING, description: 'ID ou nome da meta.' },
        amount: { type: Type.NUMBER, description: 'Valor do aporte.' },
        sourceAccountId: {
          type: Type.STRING,
          description: 'ID ou nome opcional da conta de onde sairá o dinheiro.',
        },
      },
      required: ['goalId', 'amount'],
    },
  },
  {
    name: 'delete_goal',
    description: 'Exclui diretamente uma meta financeira pelo ID ou nome.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        goalId: { type: Type.STRING, description: 'ID ou nome da meta.' },
      },
      required: ['goalId'],
    },
  },
  {
    name: 'open_app_form',
    description:
      'Abre qualquer formulário modal do aplicativo e já preenche todos os campos automaticamente na tela para o usuário revisar ou finalizar, quando isso for solicitado ou conveniente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        formType: {
          type: Type.STRING,
          description:
            'Qual formulário abrir: transaction, account, budget, goal, goal_contribution ou category.',
        },
        editingId: {
          type: Type.STRING,
          description: 'ID opcional do registro existente para abrir o formulário no modo edição.',
        },
        type: { type: Type.STRING, description: 'Tipo (income/expense/transfer ou tipo da conta).' },
        amount: { type: Type.NUMBER },
        description: { type: Type.STRING },
        name: { type: Type.STRING },
        institution: { type: Type.STRING },
        balance: { type: Type.NUMBER },
        creditLimit: { type: Type.NUMBER },
        closingDay: { type: Type.INTEGER },
        dueDay: { type: Type.INTEGER },
        categoryId: { type: Type.STRING },
        accountId: { type: Type.STRING },
        toAccountId: { type: Type.STRING },
        date: { type: Type.STRING, description: 'YYYY-MM-DD' },
        deadline: { type: Type.STRING, description: 'YYYY-MM-DD para meta' },
        targetAmount: { type: Type.NUMBER },
        currentAmount: { type: Type.NUMBER },
        status: { type: Type.STRING, description: 'paid ou pending' },
        installments: { type: Type.INTEGER },
        isRecurring: { type: Type.BOOLEAN },
        recurrenceFrequency: { type: Type.STRING },
        notes: { type: Type.STRING },
        color: { type: Type.STRING },
        goalId: { type: Type.STRING, description: 'ID ou nome da meta para aporte/edição.' },
        sourceAccountId: { type: Type.STRING, description: 'Conta de origem para aporte em meta.' },
      },
      required: ['formType'],
    },
  },
  {
    name: 'filter_transactions_view',
    description:
      'Abre a aba Lançamentos e aplica filtros visuais na tabela (período, busca, tipo, conta, categoria ou situação).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        scope: { type: Type.STRING, description: 'month ou all.' },
        search: { type: Type.STRING },
        type: { type: Type.STRING, description: 'all, income, expense ou transfer.' },
        accountId: { type: Type.STRING, description: 'all ou ID/nome da conta.' },
        categoryId: { type: Type.STRING, description: 'all ou ID/nome da categoria.' },
        status: { type: Type.STRING, description: 'all, paid ou pending.' },
      },
    },
  },
  {
    name: 'export_transactions_csv',
    description:
      'Gera e baixa imediatamente um arquivo CSV do extrato (mês atual, todo o período ou filtrado).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        scope: { type: Type.STRING, description: 'month ou all (padrão: month).' },
        month: { type: Type.STRING, description: 'Mês YYYY-MM (padrão: mês selecionado).' },
        type: { type: Type.STRING, description: 'Opcional: income, expense ou transfer.' },
        categoryId: { type: Type.STRING, description: 'Opcional: ID ou nome da categoria.' },
        accountId: { type: Type.STRING, description: 'Opcional: ID ou nome da conta.' },
      },
    },
  },
  {
    name: 'set_reports_range',
    description: 'Abre a tela Relatórios e DRE configurada para 6 ou 12 meses.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        monthsCount: { type: Type.INTEGER, description: '6 ou 12.' },
      },
      required: ['monthsCount'],
    },
  },
  {
    name: 'navigate_to_tab',
    description: 'Navega a interface do aplicativo para qualquer tela do sistema, incluindo Assistente IA ou Aplicativos/Downloads.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tab: {
          type: Type.STRING,
          description:
            'Aba destino: assistant, dashboard, transactions, accounts, budgets, goals, reports, categories ou downloads.',
        },
      },
      required: ['tab'],
    },
  },
  {
    name: 'open_settings',
    description:
      'Abre a janela de Configurações e Conta do aplicativo diretamente na seção desejada (Preferências de moeda/tema, Perfil, Segurança, Uso de API por modelo, IA Admin ou Banco Admin).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        section: {
          type: Type.STRING,
          description: 'Seção alvo: preferences, profile, security, usage, ai ou database.',
        },
      },
    },
  },
  {
    name: 'set_selected_month',
    description: 'Altera o mês e ano selecionados no seletor do aplicativo.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        month: { type: Type.STRING, description: 'Mês no formato YYYY-MM.' },
      },
      required: ['month'],
    },
  },
  {
    name: 'set_currency',
    description: 'Altera a moeda principal exibida no sistema (BRL, USD ou EUR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        currency: { type: Type.STRING, description: 'Código da moeda: BRL, USD ou EUR.' },
      },
      required: ['currency'],
    },
  },
  {
    name: 'toggle_theme',
    description: 'Alterna o tema visual entre claro (light) e escuro (dark).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetTheme: {
          type: Type.STRING,
          description: 'Opcional: light ou dark. Se omitido, alterna o atual.',
        },
      },
    },
  },
  {
    name: 'load_sample_data',
    description:
      'Carrega o cenário financeiro brasileiro de demonstração com contas, cartões, metas, orçamentos e 5 meses de transações.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];
