package br.com.petstory.config;

// Centraliza URL e chaves do Supabase (pega das variáveis de ambiente ou usa o padrão abaixo)
public class SupabaseConfig {

    public static final String SUPABASE_URL = obterVariavelOuPadrao(
        "SUPABASE_URL", 
        "https://tiqzidcqqscarcdgbcgr.supabase.co"
    );

    public static final String SUPABASE_ANON_KEY = obterVariavelOuPadrao(
        "SUPABASE_ANON_KEY",
        "sb_publishable_92MgWBkRVu6i3vmS2xTWdw_io6Gk-wj"
    );

    public static final String ADMIN_RPC_KEY = obterVariavelOuPadrao(
        "ADMIN_RPC_KEY",
        "PetStoryAdmin#2026"
    );

    public static final String JDBC_URL = 
        "jdbc:postgresql://db.tiqzidcqqscarcdgbcgr.supabase.co:5432/postgres?sslmode=require";

    // Monta a URL REST da tabela evitando barra duplicada caso /rest/v1 já venha na base
    public static String obterEndpointTabela(String nomeTabela) {
        String base = SUPABASE_URL.trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        if (base.endsWith("/rest/v1")) {
            return base + "/" + nomeTabela;
        }
        return base + "/rest/v1/" + nomeTabela;
    }

    // Monta a URL REST para chamar uma função RPC no Supabase
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

    private static String obterVariavelOuPadrao(String nomeVariavel, String valorPadrao) {
        String valorEnv = System.getenv(nomeVariavel);
        if (valorEnv != null && !valorEnv.trim().isEmpty()) {
            return valorEnv;
        }
        return valorPadrao;
    }
}
