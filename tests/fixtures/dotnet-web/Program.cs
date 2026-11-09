var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/", () => "Web App fixture");
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
