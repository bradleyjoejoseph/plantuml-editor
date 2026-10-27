export const TEMPLATES = {
  sequence: {
    name: 'Sequence Diagram',
    category: 'Interaction',
    code: `@startuml
autonumber
skinparam style strictuml
actor User
participant "Web App" as App
participant "Auth Service" as Auth
database "Database" as DB

User -> App: Click "Sign in with SSO"
activate App
App -> Auth: POST /api/auth/login
activate Auth
Auth -> DB: Verify user credentials
activate DB
DB --> Auth: User profile & permissions
deactivate DB
Auth --> App: 200 OK + JWT Token
deactivate Auth
App --> User: Redirect to Dashboard
deactivate App
@enduml`
  },

  class: {
    name: 'Class Diagram',
    category: 'Structure',
    code: `@startuml
skinparam classAttributeIconSize 0

abstract class User {
  +id: UUID
  +email: String
  +name: String
  +createdAt: DateTime
  +login(): Boolean
  +logout(): Void
}

class Customer {
  +shippingAddress: Address
  +billingAddress: Address
  +placeOrder(items: List<OrderItem>): Order
}

class Administrator {
  +role: AdminRole
  +manageUsers(): Void
  +viewAuditLogs(): List<Log>
}

class Order {
  +id: UUID
  +totalAmount: Decimal
  +status: OrderStatus
  +calculateTax(): Decimal
  +processPayment(): Boolean
}

class OrderItem {
  +productId: UUID
  +quantity: Integer
  +unitPrice: Decimal
}

User <|-- Customer
User <|-- Administrator
Customer "1" *-- "0..*" Order : places
Order "1" *-- "1..*" OrderItem : contains
@enduml`
  },

  activity: {
    name: 'Activity / Flowchart',
    category: 'Behavior',
    code: `@startuml
start
:User submits checkout form;

if (Cart is empty?) then (yes)
  :Show "Cart Empty" error;
  stop
else (no)
  :Validate inventory;
  if (Items in stock?) then (yes)
    :Authorize payment;
    if (Payment successful?) then (yes)
      :Create order record;
      fork
        :Send confirmation email;
      fork again
        :Notify warehouse fulfillment;
      end fork
      :Display order receipt;
      stop
    else (no)
      :Display payment error;
      :Prompt user to retry;
      stop
    endif
  else (no)
    :Mark out-of-stock items;
    :Notify customer;
    stop
  endif
endif
@enduml`
  },

  state: {
    name: 'State Machine',
    category: 'Behavior',
    code: `@startuml
[*] --> Draft

Draft --> PendingReview : Submit for Review
PendingReview --> Draft : Changes Requested
PendingReview --> Approved : Approve

state Approved {
  [*] --> Staged
  Staged --> Deploying : Trigger Deploy
  Deploying --> Live : Deploy Success
  Deploying --> Failed : Deploy Error
  Failed --> Staged : Retry
}

Live --> Archived : Deprecate
Archived --> [*]
@enduml`
  },

  component: {
    name: 'Component / Cloud Architecture',
    category: 'Structure',
    code: `@startuml
package "Client Layer" {
  [Web Browser] as Web
  [Mobile App] as Mobile
}

package "API Gateway" {
  [Reverse Proxy / TLS] as Proxy
  [Rate Limiter] as Limiter
}

package "Backend Services" {
  [GraphQL API] as API
  [Worker Service] as Worker
  [Notification Engine] as Notify
}

database "PostgreSQL" as DB
database "Redis Cache" as Cache
queue "Message Queue (Kafka)" as Queue

Web --> Proxy : HTTPS
Mobile --> Proxy : HTTPS
Proxy --> Limiter
Limiter --> API : Internal HTTP/2
API --> Cache : Fast Reads
API --> DB : Read / Write
API --> Queue : Publish Events
Queue --> Worker : Consume
Worker --> Notify : Trigger Alerts
@enduml`
  },

  usecase: {
    name: 'Use Case Diagram',
    category: 'Requirements',
    code: `@startuml
left to right direction
actor "Customer" as cust
actor "Payment Gateway" as stripe
actor "Store Admin" as admin

rectangle "E-Commerce System" {
  usecase "Browse Catalog" as UC1
  usecase "Add to Cart" as UC2
  usecase "Checkout & Pay" as UC3
  usecase "Process Credit Card" as UC4
  usecase "Manage Inventory" as UC5
  usecase "View Sales Analytics" as UC6
}

cust --> UC1
cust --> UC2
cust --> UC3
UC3 ..> UC4 : <<include>>
stripe --> UC4
admin --> UC5
admin --> UC6
@enduml`
  },

  mindmap: {
    name: 'Mind Map',
    category: 'Concept',
    code: `@startmindmap
* PlantUML Studio
** Core Features
*** Live Preview
*** Ad-Free Experience
*** Fast Rendering
** Export Capabilities
*** PNG Export
**** Transparent Background
**** White Background
**** 1x / 2x / 3x Retina
*** JPEG Export
*** SVG Vector
*** Direct Clipboard Copy
** Developer Ergonomics
*** Tab Indentation
*** Auto-Brackets
*** Shareable URL Hashes
*** Offline Storage
@endmindmap`
  },

  c4: {
    name: 'C4 Architecture (System Context)',
    category: 'Architecture',
    code: `@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml

Person(customer, "Customer", "A customer of the bank with personal accounts.")
System(banking_system, "Internet Banking System", "Allows customers to view information about their accounts and make payments.")

System_Ext(mail_system, "E-mail System", "The internal Microsoft Exchange e-mail system.")
System_Ext(mainframe, "Mainframe Banking System", "Stores core banking accounts, transactions, and ledgers.")

Rel(customer, banking_system, "Uses", "HTTPS")
Rel_Back(customer, mail_system, "Sends e-mails to")
Rel_Neighbor(banking_system, mail_system, "Sends e-mails", "SMTP")
Rel(banking_system, mainframe, "Retrieves account data & pushes transactions", "TCP/IP")
@enduml`
  },

  json: {
    name: 'JSON / Data Structure',
    category: 'Data',
    code: `@startjson
{
  "application": "PlantUML Studio",
  "version": "1.0.0",
  "features": {
    "adware": false,
    "instant_preview": true,
    "background_options": ["transparent", "white"],
    "export_formats": ["png", "jpeg", "svg"],
    "resolutions": ["1x", "2x Retina", "3x High-DPI"]
  },
  "endpoints": {
    "kroki": "https://kroki.io/plantuml/svg",
    "official": "https://www.plantuml.com/plantuml/svg"
  }
}
@endjson`
  },

  gantt: {
    name: 'Gantt Chart (Schedule)',
    category: 'Planning',
    code: `@startgantt
Project starts 2026-11-01
[Architecture Design] lasts 5 days
[Prototype Development] lasts 10 days
[Prototype Development] starts at [Architecture Design]'s end
[UI & UX Polish] lasts 4 days
[UI & UX Polish] starts at [Prototype Development]'s end
[Integration Testing] lasts 3 days
[Integration Testing] starts at [UI & UX Polish]'s end
[Production Release] happens at [Integration Testing]'s end
@endgantt`
  }
};
