package br.com.petstory.server;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/**
 * ============================================================================
 * TESTES DE INTEGRAÇÃO HTTP: PetStoryHttpServerTest
 * ============================================================================
 * Valida a inicialização do servidor HTTP nativo, o suporte a CORS,
 * e os novos endpoints de autenticação e OTP.
 */
public class PetStoryHttpServerTest {

    private static final int PORTA_TESTE = 8089;
    private static PetStoryHttpServer servidor;
    private static HttpClient client;
    private static final String BASE_URL = "http://localhost:" + PORTA_TESTE;

    @BeforeAll
    public static void setUp() throws IOException {
        servidor = new PetStoryHttpServer(PORTA_TESTE);
        servidor.start();
        client = HttpClient.newHttpClient();
    }

    @AfterAll
    public static void tearDown() {
        if (servidor != null) {
            servidor.stop();
        }
    }

    @Test
    @DisplayName("GET /api/health deve retornar status 200 e status OK")
    public void testHealthCheck() throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/health"))
                .GET()
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());

        assertEquals(200, resp.statusCode());
        JsonObject json = JsonParser.parseString(resp.body()).getAsJsonObject();
        assertEquals("OK", json.get("status").getAsString());
        assertEquals("PetStory Backend Server", json.get("service").getAsString());
    }

    @Test
    @DisplayName("OPTIONS em qualquer endpoint deve responder 204 com cabeçalhos CORS completos")
    public void testCorsPreflight() throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/auth/login-tutor"))
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());

        assertEquals(204, resp.statusCode());
        assertTrue(resp.headers().firstValue("Access-Control-Allow-Origin").isPresent());
        assertEquals("*", resp.headers().firstValue("Access-Control-Allow-Origin").get());
        assertTrue(resp.headers().firstValue("Access-Control-Allow-Methods").isPresent());
    }

    @Test
    @DisplayName("POST /api/auth/login-tutor deve autorizar com credenciais corretas")
    public void testLoginTutorSucesso() throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("email", "mariana@email.com");
        body.addProperty("senha", "senha123");

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/auth/login-tutor"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());

        assertEquals(200, resp.statusCode());
        JsonObject json = JsonParser.parseString(resp.body()).getAsJsonObject();
        assertTrue(json.get("sucesso").getAsBoolean());
        assertTrue(json.has("token"));
        assertTrue(json.get("token").getAsString().startsWith("pst_sess_tutor_"));
        assertEquals("Mariana Vasconcelos", json.getAsJsonObject("tutor").get("nome").getAsString());
    }

    @Test
    @DisplayName("POST /api/auth/login-tutor deve bloquear senha incorreta com HTTP 401")
    public void testLoginTutorSenhaIncorreta() throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("email", "mariana@email.com");
        body.addProperty("senha", "senha_totalmente_errada_999");

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/auth/login-tutor"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());

        assertEquals(401, resp.statusCode());
        JsonObject json = JsonParser.parseString(resp.body()).getAsJsonObject();
        assertFalse(json.get("sucesso").getAsBoolean());
        assertTrue(json.get("mensagem").getAsString().contains("senha"));
    }

    @Test
    @DisplayName("POST /api/auth/login-vet deve autenticar veterinário com CRMV e UF válidos")
    public void testLoginVetSucesso() throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("crmv", "38412");
        body.addProperty("uf", "SP");
        body.addProperty("senha", "vet2026");

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/auth/login-vet"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());

        assertEquals(200, resp.statusCode());
        JsonObject json = JsonParser.parseString(resp.body()).getAsJsonObject();
        assertTrue(json.get("sucesso").getAsBoolean());
        assertTrue(json.has("token"));
        assertEquals("Dr. Ricardo Mendonça", json.getAsJsonObject("veterinario").get("nome").getAsString());
    }

    @Test
    @DisplayName("POST /api/auth/login-vet deve bloquear senha incorreta de veterinário com HTTP 401")
    public void testLoginVetSenhaIncorreta() throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("crmv", "38412");
        body.addProperty("uf", "SP");
        body.addProperty("senha", "senha_incorreta_vet");

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/auth/login-vet"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());

        assertEquals(401, resp.statusCode());
    }

    @Test
    @DisplayName("Ciclo completo de OTP: Geração segura, bloqueio de código errado, validação com sucesso e bloqueio de reuso")
    public void testCicloCompletoOtp() throws Exception {
        // 1. Tutor gera novo código OTP para Thor (PST-9921)
        JsonObject gerarBody = new JsonObject();
        gerarBody.addProperty("tag", "PST-9921");

        HttpRequest reqGerar = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/otp/gerar"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(gerarBody.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> respGerar = client.send(reqGerar, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, respGerar.statusCode());
        JsonObject jsonGerar = JsonParser.parseString(respGerar.body()).getAsJsonObject();
        assertTrue(jsonGerar.get("sucesso").getAsBoolean());
        String otpGerado = jsonGerar.get("codigoOtp").getAsString();
        assertNotNull(otpGerado);
        assertEquals(6, otpGerado.length());

        // 2. Veterinário tenta código aleatório incorreto -> DEVE REJEITAR (401)
        JsonObject validarErroBody = new JsonObject();
        validarErroBody.addProperty("tag", "PST-9921");
        validarErroBody.addProperty("codigoOtp", "000000");

        HttpRequest reqErro = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/otp/validar"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(validarErroBody.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> respErro = client.send(reqErro, HttpResponse.BodyHandlers.ofString());
        assertEquals(401, respErro.statusCode());

        // 3. Veterinário digita o código correto gerado -> DEVE AUTORIZAR (200)
        JsonObject validarOkBody = new JsonObject();
        validarOkBody.addProperty("tag", "PST-9921");
        validarOkBody.addProperty("codigoOtp", otpGerado);

        HttpRequest reqOk = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/otp/validar"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(validarOkBody.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> respOk = client.send(reqOk, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, respOk.statusCode());
        JsonObject jsonOk = JsonParser.parseString(respOk.body()).getAsJsonObject();
        assertTrue(jsonOk.get("sucesso").getAsBoolean());
        assertTrue(jsonOk.get("autorizado").getAsBoolean());

        // 4. Veterinário tenta reutilizar o mesmo código -> DEVE REJEITAR (401 - One-Time Password)
        HttpResponse<String> respReuso = client.send(reqOk, HttpResponse.BodyHandlers.ofString());
        assertEquals(401, respReuso.statusCode());
        JsonObject jsonReuso = JsonParser.parseString(respReuso.body()).getAsJsonObject();
        assertTrue(jsonReuso.get("mensagem").getAsString().contains("utilizado"));
    }

    @Test
    @DisplayName("GET /api/pets/{id}/prontuario deve retornar prontuário completo consolidado")
    public void testObterProntuarioThor() throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/pets/PST-9921/prontuario"))
                .GET()
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());

        assertEquals(200, resp.statusCode());
        JsonObject json = JsonParser.parseString(resp.body()).getAsJsonObject();
        assertTrue(json.get("sucesso").getAsBoolean());
        assertEquals("Thor", json.getAsJsonObject("pet").get("nome").getAsString());
        assertEquals("PST-9921", json.getAsJsonObject("pet").get("tag").getAsString());
        assertTrue(json.getAsJsonArray("vacinas").size() >= 4);
        assertTrue(json.getAsJsonArray("cirurgias").size() >= 1);
        assertTrue(json.getAsJsonArray("prescricoes").size() >= 1);
        assertTrue(json.has("lembretes"));
    }

    @Test
    @DisplayName("POST /api/vacinas deve cadastrar nova vacina e refletir no prontuário do Bolinha")
    public void testCadastrarVacinaBolinha() throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("petId", "PST-1428");
        body.addProperty("nome", "V10 Polivalente Canina");
        body.addProperty("lote", "Zoetis • Lote 9942-B");
        body.addProperty("data_aplicacao", "2026-11-07");
        body.addProperty("data_reforco", "2027-11-07");
        body.addProperty("veterinario_crmv", "Dr. Ricardo Mendonça (CRMV-SP 38.412)");

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/vacinas"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        assertEquals(201, resp.statusCode());

        JsonObject json = JsonParser.parseString(resp.body()).getAsJsonObject();
        assertTrue(json.get("sucesso").getAsBoolean());
        assertEquals("V10 Polivalente Canina", json.getAsJsonObject("vacina").get("nomeVacina").getAsString());

        // Confirma que agora aparece no prontuário do Bolinha (sincronização imediata)
        HttpRequest reqProntuario = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/pets/PST-1428/prontuario"))
                .GET()
                .build();

        HttpResponse<String> respProntuario = client.send(reqProntuario, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, respProntuario.statusCode());
        JsonObject prontuarioJson = JsonParser.parseString(respProntuario.body()).getAsJsonObject();
        assertEquals("Bolinha", prontuarioJson.getAsJsonObject("pet").get("nome").getAsString());
        assertFalse(prontuarioJson.getAsJsonArray("vacinas").isEmpty());
        assertEquals("V10 Polivalente Canina", prontuarioJson.getAsJsonArray("vacinas").get(0).getAsJsonObject().get("nome").getAsString());
    }

    @Test
    @DisplayName("POST /api/cirurgias deve agendar cirurgia e gerar lembrete para o tutor")
    public void testAgendarCirurgiaBolinha() throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("petId", "PST-1428");
        body.addProperty("nome", "Castração Eletiva & Implante de Chip");
        body.addProperty("data", "15/12/2026");
        body.addProperty("cirurgiao", "Dr. André Villela (CRMV-SP 31.020)");
        body.addProperty("notas", "Jejum alimentar de 8h e hídrico de 2h");
        body.addProperty("status", "Agendada");

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/cirurgias"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        assertEquals(201, resp.statusCode());

        JsonObject json = JsonParser.parseString(resp.body()).getAsJsonObject();
        assertTrue(json.get("sucesso").getAsBoolean());
        assertEquals("Castração Eletiva & Implante de Chip", json.getAsJsonObject("cirurgia").get("nome").getAsString());

        // Verifica se a cirurgia aparece nos lembretes do prontuário
        HttpRequest reqProntuario = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/pets/PST-1428/prontuario"))
                .GET()
                .build();

        HttpResponse<String> respProntuario = client.send(reqProntuario, HttpResponse.BodyHandlers.ofString());
        JsonObject prontuarioJson = JsonParser.parseString(respProntuario.body()).getAsJsonObject();
        assertFalse(prontuarioJson.getAsJsonArray("cirurgias").isEmpty());
        assertFalse(prontuarioJson.getAsJsonArray("lembretes").isEmpty());
    }

    @Test
    @DisplayName("POST /api/prescricoes deve emitir prescrição ativa para o pet")
    public void testPrescreverMedicamento() throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("petId", "PST-1428");
        body.addProperty("nome", "Simparic 20mg (Sarolaner)");
        body.addProperty("tipo", "Oral / Mastigável");
        body.addProperty("indicacao", "Tratamento e prevenção de pulgas e carrapatos");
        body.addProperty("posologia", "1 comprimido mastigável dose única a cada 35 dias");
        body.addProperty("veterinario", "Dra. Camila Fontes (CRMV-SP 44.910)");

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/prescricoes"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        assertEquals(201, resp.statusCode());

        JsonObject json = JsonParser.parseString(resp.body()).getAsJsonObject();
        assertTrue(json.get("sucesso").getAsBoolean());
        assertEquals("Simparic 20mg (Sarolaner)", json.getAsJsonObject("prescricao").get("nome").getAsString());
    }
}
