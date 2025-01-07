import argparse

from ltu.ltu import provision

if __name__ == '__main__':
    # Create the argument parser
    parser = argparse.ArgumentParser(
        description="Process hostname, latitude, and longitude."
    )

    # Add required positional arguments
    parser.add_argument("hostname", type=str, help="LTU- will be prefixed")
    parser.add_argument("lat", type=float, help="Latitude (as a float)")
    parser.add_argument("lon", type=float, help="Longitude (as a float)")

    # Parse the arguments
    args = parser.parse_args()

    # Convert the arguments into a dictionary
    args_dict = {
        "hostname": args.hostname,
        "lat": args.lat,
        "lon": args.lon,
    }

    # Print the dictionary (or handle it as needed)
    provision(args_dict)