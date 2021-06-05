# [Experimental] REST and OpenAPI support for WIDL

This library works in tandem with [`wapc/widl-js`](https://github.com/wapc/widl-js) to describe REST APIs and produce OpenAPI specifications.

## Installation

```sh
$ wapc install github.com/pkedy/widl-restapi main
```

## Example WIDL

```graphql
import * from "@widl/restapi"

namespace "customers"
  @path("/v1")
  @info(
    title: "Customers API",
    description: """
    This is a test
    """,
    version: "1.0",
    contact: {
      name: "MyCompany API Team",
      email: "apiteam@mycompany.io",
      url: "http://mycompany.io"
    },
    license: {
      name: "Apache 2.0",
      url: "https://www.apache.org/licenses/LICENSE-2.0.html"
    }
  )
  @host("swagger.io")
  @schemes(["https"])
  @consumes(["application/json"])
  @produces(["application/json"])
  @externalDocs(
    url: "http://swagger.io/docs"
  )

interface @path("/customers") {
  """
  Creates a new customer.
  """
  createCustomer{customer: CustomerFields}: Customer
    @summary("Summary of creating a new customer")
    @POST
    @response(
      status: CREATED,
      description: "Successful response",
      examples: {
        "application/json": "json",
        csv: ""
      }
    )
  """
  Returns a customer.
  """
  getCustomer(id: string): Customer
    @path("/{id}")
    @GET
    @response(
      status: OK,
      description: "Successful response",
      examples: {
        "application/json": "json",
        csv: ""
      }
    )
    @response(
      status: NOT_FOUND,
      returns: "Error",
      description: "No customer with that identifier",
      examples: {
        "application/json": "json",
        csv: ""
      }
    )
  """
  Update a customer.
  """
  updateCustomer(customer: Customer): Customer
    @path("/{id}")
    @PUT
    @response(
      status: OK,
      description: "Successful response",
      examples: {
        "application/json": "json",
        csv: ""
      }
    )
  """
  Deletes a customer.
  """
  deleteCustomer(id: string): Customer
    @path("/{id}")
    @DELETE
    @response(
      status: OK,
      description: "Successful response",
      examples: {
        "application/json": "json",
        csv: ""
      }
    )
  """
  Lists customers using a search filter.
  """
  listCustomers{search: CustomerSearch @query}: CustomerPage
    @GET
    @response(
      status: OK,
      description: "Successful response",
      examples: {
        "application/json": "json",
        csv: ""
      }
    )
}

"""
Fields for a customer.
"""
type CustomerFields {
  "The customer's first name"
  firstName: string
  "The customer's last name"
  lastName: string
}

"""
The customer type.
"""
type Customer {
  "The customer identifier"
  id: string
  "The customer's first name"
  firstName: string
  "The customer's last name"
  lastName: string
}

type CustomerSearch {
  offset: u32
  limit: u32
  query: string
}

type CustomerPage {
  offset: u32
  items: [Customer]
}

type Error {
  message: string
}
```

## License

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)