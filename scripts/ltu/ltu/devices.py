def get_info():
    return {"username": "ubnt", "password": "Freeboxe1903"}


def create_info():
    return {"username": "ubnt", "password": "Freeboxe1903"}


def get_credentials(device_info):
    creds = ["ubnt", "ubnt"]
    if "username" in device_info:
        creds[0] = device_info["username"]
    if "password" in device_info:
        creds[1] = device_info["password"]
    return creds
