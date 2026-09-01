use futures_util::future::{AbortHandle, Abortable};
use keyring::{Entry, Error as KeyringError};
use reqwest::{header::HeaderMap, Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
    time::Duration,
};

const KEYCHAIN_SERVICE: &str = "com.masamine.videolecture2notes.openai";
const KEYCHAIN_ACCOUNT: &str = "default";
const OPENAI_MODEL: &str = "gpt-5.6-luna";
const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";
const OPENAI_MODEL_URL: &str = "https://api.openai.com/v1/models/gpt-5.6-luna";
const MAX_PROMPT_BYTES: usize = 2 * 1024 * 1024;

static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();
static ACTIVE_REQUESTS: OnceLock<Mutex<HashMap<String, AbortHandle>>> = OnceLock::new();

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiCredentialStatus {
    configured: bool,
    last_four: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiArticleRequest {
    instructions: String,
    input: String,
    max_output_tokens: u32,
    client_request_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiUsage {
    input_tokens: u64,
    output_tokens: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiArticleResponse {
    body: String,
    request_id: Option<String>,
    usage: Option<OpenAiUsage>,
}

#[derive(Deserialize)]
struct ApiErrorEnvelope {
    error: Option<ApiError>,
}

#[derive(Deserialize)]
struct ApiError {
    message: Option<String>,
}

#[derive(Deserialize)]
struct ResponsesApiResponse {
    output_text: Option<String>,
    #[serde(default)]
    output: Vec<ResponseOutputItem>,
    usage: Option<ResponsesUsage>,
}

#[derive(Deserialize)]
struct ResponseOutputItem {
    #[serde(default)]
    content: Vec<ResponseContentItem>,
}

#[derive(Deserialize)]
struct ResponseContentItem {
    text: Option<String>,
}

#[derive(Deserialize)]
struct ResponsesUsage {
    input_tokens: u64,
    output_tokens: u64,
}

fn keychain_entry() -> Result<Entry, String> {
    Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .map_err(|error| format!("macOS Keychainを利用できません: {error}"))
}

fn http_client() -> Result<&'static Client, String> {
    if let Some(client) = HTTP_CLIENT.get() {
        return Ok(client);
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(180))
        .user_agent("VideoLecture2Notes/0.1")
        .build()
        .map_err(|error| format!("OpenAI APIクライアントを準備できません: {error}"))?;
    let _ = HTTP_CLIENT.set(client);
    HTTP_CLIENT
        .get()
        .ok_or_else(|| "OpenAI APIクライアントを準備できません".to_string())
}

fn active_requests() -> &'static Mutex<HashMap<String, AbortHandle>> {
    ACTIVE_REQUESTS.get_or_init(|| Mutex::new(HashMap::new()))
}

async fn stored_api_key() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        keychain_entry()?
            .get_password()
            .map_err(|error| match error {
                KeyringError::NoEntry => "OpenAI APIキーが設定されていません".to_string(),
                _ => format!("macOS KeychainからOpenAI APIキーを読み取れません: {error}"),
            })
    })
    .await
    .map_err(|error| format!("APIキー読み取り処理が終了しました: {error}"))?
}

fn validate_api_key_format(api_key: &str) -> Result<String, String> {
    let api_key = api_key.trim();
    if api_key.len() < 20 || api_key.chars().any(char::is_whitespace) {
        return Err("OpenAI APIキーの形式を確認してください".to_string());
    }
    Ok(api_key.to_string())
}

async fn api_error(response: reqwest::Response) -> String {
    let status = response.status();
    let detail = response
        .json::<ApiErrorEnvelope>()
        .await
        .ok()
        .and_then(|result| result.error)
        .and_then(|error| error.message)
        .map(|message| message.chars().take(800).collect::<String>());

    match status {
        StatusCode::UNAUTHORIZED => "OpenAI APIキーが無効です".to_string(),
        StatusCode::FORBIDDEN => {
            "このAPIキーにはGPT-5.6 Lunaを利用する権限がありません".to_string()
        }
        StatusCode::TOO_MANY_REQUESTS => {
            "OpenAI APIのレート制限または利用上限に達しました".to_string()
        }
        _ => format!(
            "OpenAI APIの応答に失敗しました (HTTP {status}){}",
            detail.map(|value| format!(": {value}")).unwrap_or_default()
        ),
    }
}

async fn verify_api_key(api_key: &str) -> Result<(), String> {
    let response = http_client()?
        .get(OPENAI_MODEL_URL)
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|error| format!("OpenAI APIへ接続できません: {error}"))?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(api_error(response).await)
    }
}

fn response_request_id(headers: &HeaderMap) -> Option<String> {
    headers
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
}

#[tauri::command]
pub async fn get_openai_api_key_status() -> Result<OpenAiCredentialStatus, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let entry = keychain_entry()?;
        match entry.get_password() {
            Ok(api_key) => Ok(OpenAiCredentialStatus {
                configured: true,
                last_four: Some(
                    api_key
                        .chars()
                        .rev()
                        .take(4)
                        .collect::<String>()
                        .chars()
                        .rev()
                        .collect(),
                ),
            }),
            Err(KeyringError::NoEntry) => Ok(OpenAiCredentialStatus {
                configured: false,
                last_four: None,
            }),
            Err(error) => Err(format!(
                "macOS KeychainからOpenAI APIキーの状態を読み取れません: {error}"
            )),
        }
    })
    .await
    .map_err(|error| format!("APIキー確認処理が終了しました: {error}"))?
}

#[tauri::command]
pub async fn validate_and_save_openai_api_key(
    api_key: String,
) -> Result<OpenAiCredentialStatus, String> {
    let api_key = validate_api_key_format(&api_key)?;
    verify_api_key(&api_key).await?;
    let last_four = api_key
        .chars()
        .rev()
        .take(4)
        .collect::<String>()
        .chars()
        .rev()
        .collect();

    tauri::async_runtime::spawn_blocking(move || {
        keychain_entry()?
            .set_password(&api_key)
            .map_err(|error| format!("OpenAI APIキーをmacOS Keychainへ保存できません: {error}"))
    })
    .await
    .map_err(|error| format!("APIキー保存処理が終了しました: {error}"))??;

    Ok(OpenAiCredentialStatus {
        configured: true,
        last_four: Some(last_four),
    })
}

#[tauri::command]
pub async fn test_openai_connection() -> Result<(), String> {
    let api_key = stored_api_key().await?;
    verify_api_key(&api_key).await
}

#[tauri::command]
pub async fn delete_openai_api_key() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        let entry = keychain_entry()?;
        match entry.delete_credential() {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(error) => Err(format!(
                "OpenAI APIキーをmacOS Keychainから削除できません: {error}"
            )),
        }
    })
    .await
    .map_err(|error| format!("APIキー削除処理が終了しました: {error}"))?
}

#[tauri::command]
pub fn cancel_openai_request(client_request_id: String) -> Result<bool, String> {
    let handle = active_requests()
        .lock()
        .map_err(|_| "OpenAI APIリクエストの停止状態を取得できません".to_string())?
        .remove(&client_request_id);
    if let Some(handle) = handle {
        handle.abort();
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn generate_openai_article(
    request: OpenAiArticleRequest,
) -> Result<OpenAiArticleResponse, String> {
    if request.instructions.len() + request.input.len() > MAX_PROMPT_BYTES {
        return Err("OpenAIへ送信する本文生成データが大きすぎます".to_string());
    }
    if request.client_request_id.is_empty()
        || request.client_request_id.len() > 128
        || !request.client_request_id.is_ascii()
    {
        return Err("OpenAI APIリクエストIDが不正です".to_string());
    }

    let api_key = stored_api_key().await?;
    let body = json!({
        "model": OPENAI_MODEL,
        "reasoning": { "effort": "none" },
        "store": false,
        "instructions": request.instructions,
        "input": request.input,
        "max_output_tokens": request.max_output_tokens.clamp(1, 8192),
        "text": { "format": { "type": "text" }, "verbosity": "medium" }
    });

    let (abort_handle, abort_registration) = AbortHandle::new_pair();
    active_requests()
        .lock()
        .map_err(|_| "OpenAI APIリクエストを開始できません".to_string())?
        .insert(request.client_request_id.clone(), abort_handle);

    let response = Abortable::new(
        http_client()?
            .post(OPENAI_RESPONSES_URL)
            .bearer_auth(api_key)
            .header("X-Client-Request-Id", &request.client_request_id)
            .json(&body)
            .send(),
        abort_registration,
    )
    .await;

    active_requests()
        .lock()
        .map_err(|_| "OpenAI APIリクエストの終了処理に失敗しました".to_string())?
        .remove(&request.client_request_id);

    let response = response
        .map_err(|_| "OpenAI APIリクエストを停止しました".to_string())?
        .map_err(|error| format!("OpenAI APIへ接続できません: {error}"))?;
    if !response.status().is_success() {
        return Err(api_error(response).await);
    }

    let request_id = response_request_id(response.headers());
    let result = response
        .json::<ResponsesApiResponse>()
        .await
        .map_err(|error| format!("OpenAI APIの応答を読み取れません: {error}"))?;
    let body = result
        .output_text
        .or_else(|| {
            let text = result
                .output
                .iter()
                .flat_map(|item| item.content.iter())
                .filter_map(|content| content.text.as_deref())
                .collect::<String>();
            (!text.trim().is_empty()).then_some(text)
        })
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
        .ok_or_else(|| "OpenAI APIの本文応答が空でした".to_string())?;

    Ok(OpenAiArticleResponse {
        body,
        request_id,
        usage: result.usage.map(|usage| OpenAiUsage {
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
        }),
    })
}
