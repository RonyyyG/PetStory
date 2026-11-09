package br.com.petstory.client;

import br.com.petstory.config.SupabaseConfig;
import br.com.petstory.model.Vacina;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ============================================================================
 * CLIENTE HTTP SUPABASE: SupabaseRestClient
 * ============================================================================
 * Camada de comunicação direta com o banco relacional PostgreSQL do Supabase
 * utilizando a API REST oficial e HttpClient nativo do Java 21 LTS.
 *
 * Possui mecanismo de cache e fallback em memória com dados semente para
 * resiliência acadêmica (garante funcionamento mesmo sem internet).
 */
public class SupabaseRestClient {

    private final HttpClient httpClient;
    private final Gson gson;
    private final String baseUrl;
    private final String apiKey;

    // Cache local em memória para persistência rápida e resiliência offline
    private final Map<String, JsonObject> cacheOtps = new ConcurrentHashMap<>();
    private final Map<String, JsonObject> cacheTutores = new ConcurrentHashMap<>();
    private final Map<String, List<JsonObject>> cacheVacinas = new ConcurrentHashMap<>();

    public SupabaseRestClient() {
        this(SupabaseConfig.SUPABASE_URL, SupabaseConfig.SUPABASE_ANON_KEY);
    }

    public SupabaseRestClient(String baseUrl, String apiKey) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        this.gson = new Gson();
    }

    /**
     * Busca um tutor no Supabase por e-mail.
     */
    public JsonObject buscarTutorPorEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            return null;
        }
        String emailNorm = email.trim().toLowerCase();

        // 1. Tenta consulta ao banco relacional Supabase
        try {
            String url = SupabaseConfig.obterEndpointTabela("tutores") 
                    + "?email=eq." + URLEncoder.encode(emailNorm, StandardCharsets.UTF_8)
                    + "&select=*";
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonArray array = JsonParser.parseString(response.body()).getAsJsonArray();
                if (!array.isEmpty()) {
                    JsonObject tutorEncontrado = array.get(0).getAsJsonObject();
                    cacheTutores.put(emailNorm, tutorEncontrado);
                    if (tutorEncontrado.has("id")) {
                        cacheTutores.put(tutorEncontrado.get("id").getAsString(), tutorEncontrado);
                    }
                    return tutorEncontrado;
                }
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Aviso ao buscar tutor por e-mail no Supabase: " + e.getMessage());
        }

        // 2. Consulta no cache em memória
        if (cacheTutores.containsKey(emailNorm)) {
            return cacheTutores.get(emailNorm);
        }

        // 3. Fallback resiliente para tutores padrão de demonstração
        if (emailNorm.contains("mariana")) {
            JsonObject m = new JsonObject();
            m.addProperty("id", "1d41b141-75a1-4ea8-b398-4c5ff5ece979");
            m.addProperty("nome", "Mariana Vasconcelos");
            m.addProperty("email", "mariana@email.com");
            m.addProperty("telefone_emergencia", "(11) 98765-4321");
            m.addProperty("cidade", "São Paulo - SP");
            m.addProperty("senha_hash", br.com.petstory.service.AuthService.gerarHashSenha("senha123"));
            cacheTutores.put("mariana@email.com", m);
            cacheTutores.put(m.get("id").getAsString(), m);
            return m;
        } else if (emailNorm.contains("rafael")) {
            JsonObject r = new JsonObject();
            r.addProperty("id", "e99ad1d0-8fa3-43ca-9fba-e96832dc231f");
            r.addProperty("nome", "Rafael Martins Oliveira");
            r.addProperty("email", "rafael.teste@example.com");
            r.addProperty("telefone_emergencia", "(00) 90000-1234");
            r.addProperty("cidade", "Caruaru - PE");
            r.addProperty("senha_hash", br.com.petstory.service.AuthService.gerarHashSenha("123456"));
            cacheTutores.put("rafael.teste@example.com", r);
            cacheTutores.put(r.get("id").getAsString(), r);
            return r;
        }

        return null;
    }

    /**
     * Busca o pet vinculado a um tutor.
     */
    public JsonObject buscarPetPorTutorId(String tutorId) {
        if (tutorId == null || tutorId.trim().isEmpty()) {
            return null;
        }
        try {
            String url = SupabaseConfig.obterEndpointTabela("pets")
                    + "?tutor_id=eq." + URLEncoder.encode(tutorId.trim(), StandardCharsets.UTF_8)
                    + "&select=*";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonArray array = JsonParser.parseString(response.body()).getAsJsonArray();
                if (!array.isEmpty()) {
                    return array.get(0).getAsJsonObject();
                }
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Aviso ao buscar pet por tutor_id: " + e.getMessage());
        }

        // Fallback resiliente
        if ("1d41b141-75a1-4ea8-b398-4c5ff5ece979".equals(tutorId)) {
            JsonObject thor = new JsonObject();
            thor.addProperty("id", "c810977d-2eea-420e-8957-3ab54afba430");
            thor.addProperty("tutor_id", tutorId);
            thor.addProperty("nome", "Thor");
            thor.addProperty("especie", "Canina");
            thor.addProperty("raca", "Golden Retriever");
            thor.addProperty("peso", 32.8);
            thor.addProperty("sexo", "Macho");
            thor.addProperty("alergias_graves", "Dipirona e Sulfas (Choque anafilático prévio)");
            return thor;
        } else if ("e99ad1d0-8fa3-43ca-9fba-e96832dc231f".equals(tutorId)) {
            JsonObject bolinha = new JsonObject();
            bolinha.addProperty("id", "7e096a3b-0468-4347-9bee-a8286a10d416");
            bolinha.addProperty("tutor_id", tutorId);
            bolinha.addProperty("nome", "Bolinha");
            bolinha.addProperty("especie", "Canina");
            bolinha.addProperty("raca", "SRD");
            bolinha.addProperty("peso", 12.5);
            bolinha.addProperty("sexo", "Macho");
            bolinha.addProperty("alergias_graves", "Ração Pedegree, Dipirona");
            return bolinha;
        }

        return null;
    }

    /**
     * Busca a Tag PST pelo ID do Pet.
     */
    public String buscarTagPorPetId(String petId) {
        if (petId == null || petId.trim().isEmpty()) {
            return "PST-9921";
        }
        try {
            String url = SupabaseConfig.obterEndpointTabela("tags")
                    + "?pet_id=eq." + URLEncoder.encode(petId.trim(), StandardCharsets.UTF_8)
                    + "&select=*";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonArray array = JsonParser.parseString(response.body()).getAsJsonArray();
                if (!array.isEmpty()) {
                    return array.get(0).getAsJsonObject().get("codigo").getAsString();
                }
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Aviso ao buscar tag por pet_id: " + e.getMessage());
        }

        if ("7e096a3b-0468-4347-9bee-a8286a10d416".equals(petId)) {
            return "PST-1428";
        }
        return "PST-9921";
    }

    /**
     * Busca o registro da Tag pelo código alfanumérico (ex: PST-9921, PST-1428).
     */
    public JsonObject buscarTagPorCodigo(String codigoTag) {
        if (codigoTag == null || codigoTag.trim().isEmpty()) {
            return null;
        }
        String clean = codigoTag.trim().toUpperCase();
        try {
            String url = SupabaseConfig.obterEndpointTabela("tags")
                    + "?codigo=eq." + URLEncoder.encode(clean, StandardCharsets.UTF_8)
                    + "&select=*";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonArray array = JsonParser.parseString(response.body()).getAsJsonArray();
                if (!array.isEmpty()) {
                    return array.get(0).getAsJsonObject();
                }
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Aviso ao buscar tag por código: " + e.getMessage());
        }

        if ("PST-9921".equals(clean) || "981098108429182".equals(clean)) {
            JsonObject t = new JsonObject();
            t.addProperty("codigo", "PST-9921");
            t.addProperty("pet_id", "c810977d-2eea-420e-8957-3ab54afba430");
            t.addProperty("ativa", true);
            return t;
        } else if ("PST-1428".equals(clean)) {
            JsonObject t = new JsonObject();
            t.addProperty("codigo", "PST-1428");
            t.addProperty("pet_id", "7e096a3b-0468-4347-9bee-a8286a10d416");
            t.addProperty("ativa", true);
            return t;
        } else if ("PST-4022".equals(clean)) {
            JsonObject t = new JsonObject();
            t.addProperty("codigo", "PST-4022");
            t.addProperty("pet_id", "luna-pet-id-4022");
            t.addProperty("ativa", true);
            return t;
        }

        return null;
    }

    /**
     * Busca dados do pet por ID.
     */
    public JsonObject buscarPetPorId(String petId) {
        if (petId == null || petId.trim().isEmpty()) {
            return null;
        }
        try {
            String url = SupabaseConfig.obterEndpointTabela("pets")
                    + "?id=eq." + URLEncoder.encode(petId.trim(), StandardCharsets.UTF_8)
                    + "&select=*";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonArray array = JsonParser.parseString(response.body()).getAsJsonArray();
                if (!array.isEmpty()) {
                    return array.get(0).getAsJsonObject();
                }
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Aviso ao buscar pet por ID: " + e.getMessage());
        }

        if ("c810977d-2eea-420e-8957-3ab54afba430".equals(petId)) {
            JsonObject p = new JsonObject();
            p.addProperty("id", petId);
            p.addProperty("tutor_id", "1d41b141-75a1-4ea8-b398-4c5ff5ece979");
            p.addProperty("nome", "Thor");
            p.addProperty("especie", "Canina");
            p.addProperty("raca", "Golden Retriever");
            p.addProperty("peso", 32.8);
            return p;
        } else if ("7e096a3b-0468-4347-9bee-a8286a10d416".equals(petId)) {
            JsonObject p = new JsonObject();
            p.addProperty("id", petId);
            p.addProperty("tutor_id", "e99ad1d0-8fa3-43ca-9fba-e96832dc231f");
            p.addProperty("nome", "Bolinha");
            p.addProperty("especie", "Canina");
            p.addProperty("raca", "SRD");
            p.addProperty("peso", 12.5);
            return p;
        }

        return null;
    }

    /**
     * Busca dados do tutor por ID.
     */
    public JsonObject buscarTutorPorId(String tutorId) {
        if (tutorId == null || tutorId.trim().isEmpty()) {
            return null;
        }
        try {
            String url = SupabaseConfig.obterEndpointTabela("tutores")
                    + "?id=eq." + URLEncoder.encode(tutorId.trim(), StandardCharsets.UTF_8)
                    + "&select=*";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonArray array = JsonParser.parseString(response.body()).getAsJsonArray();
                if (!array.isEmpty()) {
                    return array.get(0).getAsJsonObject();
                }
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Aviso ao buscar tutor por ID: " + e.getMessage());
        }

        if ("1d41b141-75a1-4ea8-b398-4c5ff5ece979".equals(tutorId)) {
            JsonObject m = new JsonObject();
            m.addProperty("id", tutorId);
            m.addProperty("nome", "Mariana Vasconcelos");
            m.addProperty("email", "mariana@email.com");
            m.addProperty("telefone_emergencia", "(11) 98765-4321");
            m.addProperty("cidade", "São Paulo - SP");
            return m;
        } else if ("e99ad1d0-8fa3-43ca-9fba-e96832dc231f".equals(tutorId)) {
            JsonObject r = new JsonObject();
            r.addProperty("id", tutorId);
            r.addProperty("nome", "Rafael Martins Oliveira");
            r.addProperty("email", "rafael.teste@example.com");
            r.addProperty("telefone_emergencia", "(00) 90000-1234");
            r.addProperty("cidade", "Caruaru - PE");
            return r;
        }

        return null;
    }

    /**
     * Busca veterinário por CRMV (número) ou por E-mail.
     * Trata variações como "45120", "45.120", "CRMV-SP 45.120", "doutor@clinica.com", etc.
     */
    public JsonObject buscarVeterinarioPorCrmvOuEmail(String crmvOuEmail, String uf) {
        if (crmvOuEmail == null || crmvOuEmail.trim().isEmpty()) {
            return null;
        }
        String query = crmvOuEmail.trim();
        boolean isEmail = query.contains("@");
        String cleanNum = query.replaceAll("\\D", "");

        try {
            String url = SupabaseConfig.obterEndpointTabela("veterinarios") + "?select=*";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonArray array = JsonParser.parseString(response.body()).getAsJsonArray();
                for (JsonElement el : array) {
                    JsonObject vet = el.getAsJsonObject();
                    if (isEmail) {
                        String email = vet.has("email") && !vet.get("email").isJsonNull() ? vet.get("email").getAsString() : "";
                        if (email.equalsIgnoreCase(query)) {
                            return vet;
                        }
                    } else {
                        String vetCrmv = vet.has("crmv") && !vet.get("crmv").isJsonNull() ? vet.get("crmv").getAsString() : "";
                        String vetNumOnly = vetCrmv.replaceAll("\\D", "");
                        if (!cleanNum.isEmpty() && (vetNumOnly.equals(cleanNum) || vetNumOnly.contains(cleanNum))) {
                            return vet;
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Aviso ao buscar veterinário no Supabase: " + e.getMessage());
        }

        // Se não localizado no Supabase
        return null;
    }

    public JsonObject buscarVeterinarioPorCrmv(String crmvNumero, String uf) {
        return buscarVeterinarioPorCrmvOuEmail(crmvNumero, uf);
    }

    /**
     * Cadastra um novo médico-veterinário no Supabase (tabela veterinarios).
     */
    public JsonObject cadastrarVeterinario(JsonObject novoVet) {
        if (novoVet == null) {
            throw new IllegalArgumentException("Os dados do médico-veterinário são obrigatórios.");
        }

        try {
            String url = SupabaseConfig.obterEndpointTabela("veterinarios");
            String jsonBody = novoVet.toString();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(8))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json; charset=UTF-8")
                    .header("Prefer", "return=representation")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 201 || response.statusCode() == 200) {
                JsonArray arr = JsonParser.parseString(response.body()).getAsJsonArray();
                if (arr.size() > 0) {
                    JsonObject saved = arr.get(0).getAsJsonObject();
                    System.out.println("[SupabaseClient] Veterinário persistido no Supabase: " 
                            + (saved.has("nome") ? saved.get("nome").getAsString() : "") 
                            + " - " + (saved.has("crmv") ? saved.get("crmv").getAsString() : ""));
                    return saved;
                }
            } else {
                System.err.println("[SupabaseClient] Erro ao cadastrar veterinário no Supabase (HTTP " + response.statusCode() + "): " + response.body());
                throw new RuntimeException("Falha ao cadastrar veterinário no Supabase: " + response.body());
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Exceção ao cadastrar veterinário: " + e.getMessage());
            throw new RuntimeException("Erro ao cadastrar veterinário: " + e.getMessage(), e);
        }

        return novoVet;
    }

    /**
     * Lista todos os médicos-veterinários cadastrados no Supabase ordenados por nome.
     */
    public JsonArray listarVeterinarios() {
        try {
            String url = SupabaseConfig.obterEndpointTabela("veterinarios") + "?select=*&order=nome.asc";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                return JsonParser.parseString(response.body()).getAsJsonArray();
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Aviso ao listar veterinários no Supabase: " + e.getMessage());
        }

        return new JsonArray();
    }

    /**
     * Atualiza o status de atividade (ativo: true/false) de um médico-veterinário no Supabase (tabela veterinarios).
     */
    public boolean atualizarStatusVeterinario(String id, boolean ativo) {
        if (id == null || id.trim().isEmpty()) {
            throw new IllegalArgumentException("O ID do médico-veterinário é obrigatório.");
        }
        String cleanId = id.trim();
        try {
            String url = SupabaseConfig.obterEndpointTabela("veterinarios")
                    + "?id=eq." + URLEncoder.encode(cleanId, StandardCharsets.UTF_8);

            JsonObject body = new JsonObject();
            body.addProperty("ativo", ativo);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json; charset=UTF-8")
                    .header("Prefer", "return=representation")
                    .method("PATCH", HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200 || response.statusCode() == 204) {
                System.out.println("[SupabaseClient] Status do veterinário [" + cleanId + "] atualizado para ativo=" + ativo);
                return true;
            } else {
                System.err.println("[SupabaseClient] Erro ao atualizar status do veterinário (HTTP " + response.statusCode() + "): " + response.body());
                return false;
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Exceção ao atualizar status do veterinário: " + e.getMessage());
            return false;
        }
    }

    /**
     * Remove permanentemente o registro de um médico-veterinário da tabela 'veterinarios' do Supabase.
     */
    public boolean excluirVeterinario(String id) {
        if (id == null || id.trim().isEmpty()) {
            throw new IllegalArgumentException("O ID do médico-veterinário é obrigatório.");
        }
        String cleanId = id.trim();
        try {
            String url = SupabaseConfig.obterEndpointTabela("veterinarios")
                    + "?id=eq." + URLEncoder.encode(cleanId, StandardCharsets.UTF_8);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .DELETE()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200 || response.statusCode() == 204) {
                System.out.println("[SupabaseClient] Veterinário [" + cleanId + "] excluído com sucesso do Supabase.");
                return true;
            } else {
                System.err.println("[SupabaseClient] Erro ao excluir veterinário (HTTP " + response.statusCode() + "): " + response.body());
                return false;
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Exceção ao excluir veterinário: " + e.getMessage());
            return false;
        }
    }

    /**
     * Salva um código OTP no Supabase (tabela autorizacoes_otp) com expiração de 2 horas.
     */
    public JsonObject salvarOtpNoBanco(String petId, String codigoOtp, LocalDateTime expiraEm) {
        String expiraIso = expiraEm.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) + "Z";
        JsonObject body = new JsonObject();
        body.addProperty("pet_id", petId);
        body.addProperty("codigo_otp", codigoOtp);
        body.addProperty("expira_em", expiraIso);
        body.addProperty("usado", false);

        try {
            String url = SupabaseConfig.obterEndpointTabela("autorizacoes_otp");
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .header("Prefer", "return=representation")
                    .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 201 || response.statusCode() == 200) {
                JsonArray arr = JsonParser.parseString(response.body()).getAsJsonArray();
                if (!arr.isEmpty()) {
                    JsonObject criado = arr.get(0).getAsJsonObject();
                    cacheOtps.put(petId, criado);
                    return criado;
                }
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Aviso ao inserir OTP no Supabase: " + e.getMessage());
        }

        // Cache em memória para redundância
        JsonObject local = new JsonObject();
        local.addProperty("id", java.util.UUID.randomUUID().toString());
        local.addProperty("pet_id", petId);
        local.addProperty("codigo_otp", codigoOtp);
        local.addProperty("expira_em", expiraIso);
        local.addProperty("usado", false);
        local.addProperty("created_at", LocalDateTime.now().toString());
        cacheOtps.put(petId, local);
        return local;
    }

    /**
     * Busca a lista de autorizações OTP para um pet específico (mais recentes primeiro).
     */
    public List<JsonObject> buscarOtpsPorPetId(String petId) {
        List<JsonObject> lista = new ArrayList<>();
        if (petId == null || petId.trim().isEmpty()) {
            return lista;
        }

        try {
            String url = SupabaseConfig.obterEndpointTabela("autorizacoes_otp")
                    + "?pet_id=eq." + URLEncoder.encode(petId.trim(), StandardCharsets.UTF_8)
                    + "&order=created_at.desc&limit=10"
                    + "&select=*";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonArray array = JsonParser.parseString(response.body()).getAsJsonArray();
                for (JsonElement el : array) {
                    lista.add(el.getAsJsonObject());
                }
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Aviso ao buscar OTPs por pet_id: " + e.getMessage());
        }

        // Se houver OTP em cache de memória recente não retornado pelo banco, inclui
        JsonObject emCache = cacheOtps.get(petId);
        if (emCache != null) {
            boolean jaPresente = false;
            String codigoCache = emCache.get("codigo_otp").getAsString();
            for (JsonObject obj : lista) {
                if (obj.has("codigo_otp") && obj.get("codigo_otp").getAsString().equals(codigoCache)) {
                    jaPresente = true;
                    break;
                }
            }
            if (!jaPresente) {
                lista.add(0, emCache);
            }
        }

        return lista;
    }

    /**
     * Consome um OTP (marca como usado = true no banco).
     */
    public boolean marcarOtpComoUsado(String otpId, String petId) {
        if (otpId == null) return false;

        boolean atualizado = false;
        try {
            String url = SupabaseConfig.obterEndpointTabela("autorizacoes_otp")
                    + "?id=eq." + URLEncoder.encode(otpId.trim(), StandardCharsets.UTF_8);

            JsonObject patchBody = new JsonObject();
            patchBody.addProperty("usado", true);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .method("PATCH", HttpRequest.BodyPublishers.ofString(patchBody.toString(), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            atualizado = (response.statusCode() == 200 || response.statusCode() == 204);
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Aviso ao marcar OTP como usado no Supabase: " + e.getMessage());
        }

        if (petId != null && cacheOtps.containsKey(petId)) {
            JsonObject c = cacheOtps.get(petId);
            if (c.has("id") && c.get("id").getAsString().equals(otpId)) {
                c.addProperty("usado", true);
            }
        }

        return atualizado;
    }

    /**
     * Atualiza o hash criptográfico seguro da senha do tutor no Supabase.
     */
    public boolean atualizarSenhaHashTutor(String tutorId, String senhaHash) {
        if (tutorId == null || tutorId.trim().isEmpty() || senhaHash == null) {
            return false;
        }

        boolean atualizado = false;
        try {
            String url = SupabaseConfig.obterEndpointTabela("tutores")
                    + "?id=eq." + URLEncoder.encode(tutorId.trim(), StandardCharsets.UTF_8);

            JsonObject patchBody = new JsonObject();
            patchBody.addProperty("senha_hash", senhaHash);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .method("PATCH", HttpRequest.BodyPublishers.ofString(patchBody.toString(), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            atualizado = (response.statusCode() == 200 || response.statusCode() == 204);
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Aviso ao atualizar senha_hash no Supabase: " + e.getMessage());
        }

        // Atualiza cache em memória para resiliência acadêmica
        if (cacheTutores.containsKey(tutorId)) {
            cacheTutores.get(tutorId).addProperty("senha_hash", senhaHash);
            atualizado = true;
        }
        for (JsonObject tutor : cacheTutores.values()) {
            if (tutor.has("id") && tutor.get("id").getAsString().equals(tutorId)) {
                tutor.addProperty("senha_hash", senhaHash);
                atualizado = true;
            }
        }

        return atualizado;
    }

    /**
     * Busca todas as vacinas registradas para um pet no banco de dados Supabase PostgreSQL.
     * Retorna lista de JsonObject ordenada por data de aplicação decrescente.
     */
    public List<JsonObject> buscarVacinasPorPetId(String petId) {
        List<JsonObject> lista = new ArrayList<>();
        if (petId == null || petId.trim().isEmpty()) {
            return lista;
        }
        String cleanId = petId.trim();

        // 1. Consulta o Supabase via REST API
        try {
            String url = SupabaseConfig.obterEndpointTabela("vacinas")
                    + "?pet_id=eq." + URLEncoder.encode(cleanId, StandardCharsets.UTF_8)
                    + "&order=data_aplicacao.desc"
                    + "&select=*";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonArray array = JsonParser.parseString(response.body()).getAsJsonArray();
                for (JsonElement el : array) {
                    if (el.isJsonObject()) {
                        lista.add(el.getAsJsonObject());
                    }
                }
                // Atualiza o cache local
                cacheVacinas.put(cleanId, new ArrayList<>(lista));
                return lista;
            } else {
                System.err.println("[SupabaseClient] HTTP " + response.statusCode() + " ao consultar vacinas por pet_id: " + response.body());
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Aviso ao buscar vacinas por pet_id: " + e.getMessage());
        }

        // 2. Fallback para cache local em memória
        if (cacheVacinas.containsKey(cleanId)) {
            return new ArrayList<>(cacheVacinas.get(cleanId));
        }

        return lista;
    }

    /**
     * Persiste uma nova dose de vacina na tabela 'vacinas' do banco Supabase PostgreSQL.
     * Atualiza o cache local com a resposta confirmada do banco.
     */
    public JsonObject salvarVacinaNoBanco(String petId, Vacina vacina) {
        if (petId == null || vacina == null) {
            return null;
        }
        String cleanPetId = petId.trim();

        JsonObject payload = new JsonObject();
        payload.addProperty("pet_id", cleanPetId);
        payload.addProperty("nome_vacina", vacina.getNomeVacina());
        payload.addProperty("laboratorio_lote", vacina.getLoteFabricante() != null ? vacina.getLoteFabricante() : "Lote Padrão");
        payload.addProperty("data_aplicacao", vacina.getDataAplicacao() != null ? vacina.getDataAplicacao().toString() : java.time.LocalDate.now().toString());
        payload.addProperty("data_reforco", vacina.getDataReforco() != null ? vacina.getDataReforco().toString() : java.time.LocalDate.now().plusYears(1).toString());
        payload.addProperty("veterinario_crmv", vacina.getVeterinarioResponsavel() != null ? vacina.getVeterinarioResponsavel() : "CRMV Ativo");
        payload.addProperty("status", vacina.getStatus() != null ? vacina.getStatus() : "Em Dia");

        try {
            String url = SupabaseConfig.obterEndpointTabela("vacinas");

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .header("Prefer", "return=representation")
                    .POST(HttpRequest.BodyPublishers.ofString(payload.toString(), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200 || response.statusCode() == 201) {
                JsonArray array = JsonParser.parseString(response.body()).getAsJsonArray();
                if (!array.isEmpty()) {
                    JsonObject salva = array.get(0).getAsJsonObject();
                    cacheVacinas.computeIfAbsent(cleanPetId, k -> new ArrayList<>()).add(0, salva);
                    return salva;
                }
            } else {
                System.err.println("[SupabaseClient] HTTP " + response.statusCode() + " ao salvar vacina no Supabase: " + response.body());
            }
        } catch (Exception e) {
            System.err.println("[SupabaseClient] Falha ao persistir vacina no Supabase: " + e.getMessage());
        }

        // Fallback resiliente para operação offline / testes locais
        if (!payload.has("id")) {
            payload.addProperty("id", UUID.randomUUID().toString());
        }
        cacheVacinas.computeIfAbsent(cleanPetId, k -> new ArrayList<>()).add(0, payload);
        return payload;
    }
}
