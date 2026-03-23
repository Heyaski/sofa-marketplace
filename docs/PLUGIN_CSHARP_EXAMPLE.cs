// Константы
private const string ApiBaseUrl = "https://your-domain.com/api";  // или http://localhost:8000/api

// 1. Активация лицензии (вызывать при нажатии "Активировать" или при старте)
private async Task<bool> ActivateLicenseAsync()
{
    if (string.IsNullOrEmpty(_licenseHash))
    {
        MessageBox.Show("Вставьте ключ лицензии из профиля на сайте", "Ошибка",
            MessageBoxButton.OK, MessageBoxImage.Warning);
        return false;
    }

    try
    {
        using (var client = new WebClient())
        {
            client.Headers.Add("User-Agent", "SofaPlugin/1.0");
            client.Headers.Add("X-License-Hash", _licenseHash);
            client.Headers.Add("Content-Type", "application/json");

            string response = await client.UploadStringTaskAsync(
                new Uri($"{ApiBaseUrl}/plugin/activate/"), "POST", "{}");

            var json = Newtonsoft.Json.Linq.JObject.Parse(response);
            bool valid = (bool)json["valid"];
            if (!valid)
            {
                string error = (string)json["error"] ?? "Неизвестная ошибка";
                MessageBox.Show(error, "Ошибка активации", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
            _isLicenseValid = true;
            return true;
        }
    }
    catch (Exception ex)
    {
        MessageBox.Show($"Ошибка активации: {ex.Message}", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
        return false;
    }
}

// 2. Получить список товаров (для ComboBox/ListBox)
private async Task<List<ProductItem>> GetProductsAsync()
{
    using (var client = new WebClient())
    {
        client.Headers.Add("User-Agent", "SofaPlugin/1.0");
        client.Headers.Add("X-License-Hash", _licenseHash);

        string json = await client.DownloadStringTaskAsync($"{ApiBaseUrl}/plugin/products/");
        var data = Newtonsoft.Json.Linq.JObject.Parse(json);
        var products = new List<ProductItem>();

        foreach (var p in data["products"])
        {
            products.Add(new ProductItem
            {
                Id = (int)p["id"],
                Title = (string)p["title"],
                Article = (string)p["article"],
                HasGlb = (bool)p["has_glb"],
                HasRfa = (bool)p["has_rfa"]
            });
        }
        return products;
    }
}

// 3. Скачать файл (GLB или RFA)
private async void BtnDownload_Click(object sender, RoutedEventArgs e)
{
    if (!_isLicenseValid)
    {
        MessageBox.Show("Сначала активируйте лицензию", "Ошибка",
            MessageBoxButton.OK, MessageBoxImage.Warning);
        return;
    }

    // productId и format — из выбранного товара в списке
    int productId = 123;  // взять из ComboBox/ListBox
    string format = "glb";  // или "rfa"

    try
    {
        using (var client = new WebClient())
        {
            client.Headers.Add("User-Agent", "SofaPlugin/1.0");
            client.Headers.Add("X-License-Hash", _licenseHash);
            client.Headers.Add("Content-Type", "application/json");

            var body = Newtonsoft.Json.JsonConvert.SerializeObject(new { product_id = productId, format });
            string response = await client.UploadStringTaskAsync(
                new Uri($"{ApiBaseUrl}/plugin/download/"), "POST", body);

            var data = Newtonsoft.Json.Linq.JObject.Parse(response);
            string fileUrl = (string)data["url"];
            string suggestedFilename = (string)data["suggested_filename"] ?? $"model.{format}";

            if (string.IsNullOrEmpty(fileUrl))
            {
                MessageBox.Show((string)data["error"] ?? "Файл не найден", "Ошибка",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var saveDialog = new SaveFileDialog
            {
                Filter = format == "glb" ? "GLB files (*.glb)|*.glb|All Files (*.*)|*.*" : "RFA files (*.rfa)|*.rfa|All Files (*.*)|*.*",
                FileName = suggestedFilename,
                InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments)
            };

            if (saveDialog.ShowDialog() == true)
            {
                // Скачиваем по URL (без заголовков — URL уже подписан)
                using (var fileClient = new WebClient())
                {
                    await fileClient.DownloadFileTaskAsync(new Uri(fileUrl), saveDialog.FileName);
                }

                var fileInfo = new FileInfo(saveDialog.FileName);
                MessageBox.Show($"Файл успешно загружен!\n{saveDialog.FileName}\nРазмер: {fileInfo.Length} байт",
                    "Успех", MessageBoxButton.OK, MessageBoxImage.Information);
            }
        }
    }
    catch (WebException webEx)
    {
        if (webEx.Response is HttpWebResponse resp)
        {
            using (var reader = new StreamReader(resp.GetResponseStream()))
            {
                string errBody = reader.ReadToEnd();
                var err = Newtonsoft.Json.Linq.JObject.Parse(errBody);
                string msg = (string)err["error"] ?? webEx.Message;
                MessageBox.Show(msg, "Ошибка", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }
        else
        {
            MessageBox.Show(webEx.Message, "Ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }
    catch (Exception ex)
    {
        MessageBox.Show($"Ошибка: {ex.Message}", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
    }
}

public class ProductItem
{
    public int Id { get; set; }
    public string Title { get; set; }
    public string Article { get; set; }
    public bool HasGlb { get; set; }
    public bool HasRfa { get; set; }
}
