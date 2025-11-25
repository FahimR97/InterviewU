from handler import handler

def test_handler_returns_hello():
    response = handler({}, {})
    assert response["statusCode"] == 200
    assert response["body"] == "Hello from Lambda test!"

