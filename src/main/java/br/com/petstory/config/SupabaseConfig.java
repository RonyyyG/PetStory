package br.com.petstory.config;

/**
 * ============================================================================
 * CLASSE DE CONFIGURAÇÃO: SupabaseConfig
 * ============================================================================
 * 
 * ONDE COLOCAR AS CHAVES DO SUPABASE?
 * Esta classe é o ponto central onde você define a URL e as chaves de acesso
 * ao banco de dados Supabase do projeto PetStory ("A3 PetStory").
 * 
 * ONDE ENCONTRAR ESSAS INFORMAÇÕES NO SITE DO SUPABASE?
 * 1. Abra o painel do Supabase: https://supabase.com/dashboard
 * 2. Clique no seu projeto: "A3 PetStory"
 * 3. No menu lateral esquerdo, clique no ícone de engrenagem ⚙️ ("Project Settings")
 * 4. Clique na opção "API" (em Configuration)
 * 5. Nessa tela você verá dois campos principais:
 *    - "Project URL" -> Ex: https://tiqzidcqqscarcdgbcqr.supabase.co
 *    - "Project API Keys" -> Você verá duas chaves:
 *        a) 'anon' 'public' -> Chave pública de leitura/escrita do cliente.
 *        b) 'service_role' 'secret' -> Chave mestra do backend (privada).
 * 
 * COMO FUNCIONA A LEITURA NESTA CLASSE:
 * - Ela primeiro tenta ler da variável de ambiente do sistema operacional (caso exista).
 * - Se não encontrar na variável de ambiente, utiliza a constante padrão definida abaixo.
 */
public class SupabaseConfig {

    /**
     * URL base do seu projeto Supabase (REST API e Storage).
     * Copiada diretamente de: Project Settings > API > Project URL
     */
    public static final String SUPABASE_URL = obterVariavelOuPadrao(
        "SUPABASE_URL", 
        "https://tiqzidcqqscarcdgbcgr.supabase.co"
    );

    /**
     * Chave da API do Supabase (Anon Key ou Service Role Key).
     * 
     * COMO PREENCHER:
     * Substitua a String abaixo pela chave que você copiou da tela do Supabase:
     * Exemplo: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." ou "sb_publishable_..."
     */
    public static final String SUPABASE_ANON_KEY = obterVariavelOuPadrao(
        "SUPABASE_ANON_KEY",
        "sb_publishable_92MgWBkRVu6i3vmS2xTWdw_io6Gk-wj"
    );

    /**
     * Chave de autorização administrativa para chamadas RPC do Painel Admin no Supabase.
     */
    public static final String ADMIN_RPC_KEY = obterVariavelOuPadrao(
        "ADMIN_RPC_KEY",
        "PetStoryAdmin#2026"
    );

    /**
     * URL de Conexão Direta JDBC (PostgreSQL).
     * 
     * Se você desejar conectar o Java diretamente via driver PostgreSQL (JDBC):
     * - Host: db.tiqzidcqqscarcdgbcgr.supabase.co
     * - Porta: 5432
     * - Banco: postgres
     * - Usuário: postgres
     * - Senha: a senha mestra que você definiu ao criar o projeto no Supabase
     */
    public static final String JDBC_URL = 
        "jdbc:postgresql://db.tiqzidcqqscarcdgbcgr.supabase.co:5432/postgres?sslmode=require";

    /**
     * Retorna a URL completa da API REST para uma tabela específica.
     * Trata automaticamente barras extras caso a URL tenha sido colada com /rest/v1/.
     * Exemplo: obterEndpointTabela("pets") -> https://...supabase.co/rest/v1/pets
     */
    public static String obterEndpointTabela(String nomeTabela) {
        String base = SUPABASE_URL.trim();
        // Remove barras no final se houver
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        // Se a base já contiver /rest/v1, não duplica
        if (base.endsWith("/rest/v1")) {
            return base + "/" + nomeTabela;
        }
        return base + "/rest/v1/" + nomeTabela;
    }

    /**
     * Retorna a URL completa para invocação de uma função RPC segura do PostgreSQL no Supabase.
     * Exemplo: obterEndpointRpc("rpc_autenticar_tutor") -> https://...supabase.co/rest/v1/rpc/rpc_autenticar_tutor
     */
    public static String obterEndpointRpc(String nomeFuncao) {
        String base = SUPABASE_URL.trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        if (base.endsWith("/rest/v1")) {
            return base + "/rpc/" + nomeFuncao;
        }
        return base + "/rest/v1/rpc/" + nomeFuncao;
    }

    /**
     * Método auxiliar que busca valores em variáveis de ambiente ou usa o padrão.
     */
    private static String obterVariavelOuPadrao(String nomeVariavel, String valorPadrao) {
        String valorEnv = System.getenv(nomeVariavel);
        if (valorEnv != null && !valorEnv.trim().isEmpty()) {
            return valorEnv;
        }
        return valorPadrao;
    }
}
