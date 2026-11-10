
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_events": {
                  Row: {
                    "actor_id": string | null,"actor_name": string | null,"actor_type": Database["public"]['Enums']["actor_type"],"client_id": string | null,"created_at": string,"id": string,"payload": NonNullable<Json>,"request_id": string | null,"type": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"actor_name"?: string | null,"actor_type": Database["public"]['Enums']["actor_type"],"client_id"?: string | null,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"request_id"?: string | null,"type": string,"workspace_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"actor_name"?: string | null,"actor_type"?: Database["public"]['Enums']["actor_type"],"client_id"?: string | null,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"request_id"?: string | null,"type"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_events_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_events_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "onboarding_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"agreement_templates": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string | null,"id": string,"name": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agreement_templates_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_generations": {
                  Row: {
                    "created_at": string,"id": string,"input_chars": number | null,"kind": string,"model": string | null,"output": Json | null,"user_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"input_chars"?: number | null,"kind": string,"model"?: string | null,"output"?: Json | null,"user_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"input_chars"?: number | null,"kind"?: string,"model"?: string | null,"output"?: Json | null,"user_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_generations_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_type": Database["public"]['Enums']["actor_type"],"created_at": string,"entity_id": string | null,"entity_type": string | null,"id": string,"ip_address": string | null,"metadata": NonNullable<Json>,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_type": Database["public"]['Enums']["actor_type"],"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"ip_address"?: string | null,"metadata"?: NonNullable<Json>,"workspace_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_type"?: Database["public"]['Enums']["actor_type"],"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"ip_address"?: string | null,"metadata"?: NonNullable<Json>,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"client_notes": {
                  Row: {
                    "author_id": string | null,"author_name": string | null,"body": string,"client_id": string,"created_at": string,"id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"author_name"?: string | null,"body": string,"client_id": string,"created_at"?: string,"id"?: string,"workspace_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"author_name"?: string | null,"body"?: string,"client_id"?: string,"created_at"?: string,"id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_notes_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_notes_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "archived_at": string | null,"company": string | null,"created_at": string,"created_by": string | null,"email": string,"id": string,"name": string,"phone": string | null,"updated_at": string,"website": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"company"?: string | null,"created_at"?: string,"created_by"?: string | null,"email": string,"id"?: string,"name": string,"phone"?: string | null,"updated_at"?: string,"website"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"company"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string,"id"?: string,"name"?: string,"phone"?: string | null,"updated_at"?: string,"website"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string | null,"author_name": string,"author_type": Database["public"]['Enums']["actor_type"],"body": string,"created_at": string,"id": string,"read_by_agency_at": string | null,"request_id": string,"step_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"author_name": string,"author_type": Database["public"]['Enums']["actor_type"],"body": string,"created_at"?: string,"id"?: string,"read_by_agency_at"?: string | null,"request_id": string,"step_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"author_name"?: string,"author_type"?: Database["public"]['Enums']["actor_type"],"body"?: string,"created_at"?: string,"id"?: string,"read_by_agency_at"?: string | null,"request_id"?: string,"step_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "onboarding_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_step_id_fkey"
      columns: ["step_id"]
isOneToOne: false
      referencedRelation: "request_steps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "client_id": string,"file_name": string,"id": string,"item_key": string,"mime_type": string,"rejection_reason": string | null,"replaced_at": string | null,"request_id": string,"reviewed_at": string | null,"reviewed_by": string | null,"size_bytes": number,"status": Database["public"]['Enums']["document_status"],"step_id": string,"storage_path": string,"uploaded_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"file_name": string,"id"?: string,"item_key": string,"mime_type": string,"rejection_reason"?: string | null,"replaced_at"?: string | null,"request_id": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"size_bytes": number,"status"?: Database["public"]['Enums']["document_status"],"step_id": string,"storage_path": string,"uploaded_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "client_id"?: string,"file_name"?: string,"id"?: string,"item_key"?: string,"mime_type"?: string,"rejection_reason"?: string | null,"replaced_at"?: string | null,"request_id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"size_bytes"?: number,"status"?: Database["public"]['Enums']["document_status"],"step_id"?: string,"storage_path"?: string,"uploaded_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "onboarding_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_step_id_fkey"
      columns: ["step_id"]
isOneToOne: false
      referencedRelation: "request_steps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"flow_templates": {
                  Row: {
                    "archived_at": string | null,"category": string | null,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"name": string,"source": string,"steps": NonNullable<Json>,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"category"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name": string,"source"?: string,"steps"?: NonNullable<Json>,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"category"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name"?: string,"source"?: string,"steps"?: NonNullable<Json>,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "flow_templates_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"magic_links": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"id": string,"last_used_at": string | null,"request_id": string,"revoked_at": string | null,"token_hash": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at": string,"id"?: string,"last_used_at"?: string | null,"request_id": string,"revoked_at"?: string | null,"token_hash": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"last_used_at"?: string | null,"request_id"?: string,"revoked_at"?: string | null,"token_hash"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "magic_links_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "onboarding_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "magic_links_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications_log": {
                  Row: {
                    "channel": string,"created_at": string,"error": string | null,"id": string,"kind": string,"provider": string | null,"provider_message_id": string | null,"recipient": string,"request_id": string | null,"status": string,"subject": string,"triggered_by": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel"?: string,"created_at"?: string,"error"?: string | null,"id"?: string,"kind": string,"provider"?: string | null,"provider_message_id"?: string | null,"recipient": string,"request_id"?: string | null,"status": string,"subject": string,"triggered_by"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "channel"?: string,"created_at"?: string,"error"?: string | null,"id"?: string,"kind"?: string,"provider"?: string | null,"provider_message_id"?: string | null,"recipient"?: string,"request_id"?: string | null,"status"?: string,"subject"?: string,"triggered_by"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_log_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "onboarding_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_log_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"onboarding_requests": {
                  Row: {
                    "ai_brief": string | null,"ai_brief_at": string | null,"ai_summary": string | null,"ai_summary_at": string | null,"client_id": string,"completed_at": string | null,"created_at": string,"created_by": string | null,"due_date": string | null,"id": string,"last_client_activity_at": string | null,"max_reminders": number,"message": string | null,"next_reminder_at": string | null,"reminder_interval_days": number,"reminders_enabled": boolean,"reminders_sent": number,"sent_at": string | null,"status": Database["public"]['Enums']["request_status"],"template_id": string | null,"title": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_brief"?: string | null,"ai_brief_at"?: string | null,"ai_summary"?: string | null,"ai_summary_at"?: string | null,"client_id": string,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_date"?: string | null,"id"?: string,"last_client_activity_at"?: string | null,"max_reminders"?: number,"message"?: string | null,"next_reminder_at"?: string | null,"reminder_interval_days"?: number,"reminders_enabled"?: boolean,"reminders_sent"?: number,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"template_id"?: string | null,"title": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "ai_brief"?: string | null,"ai_brief_at"?: string | null,"ai_summary"?: string | null,"ai_summary_at"?: string | null,"client_id"?: string,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_date"?: string | null,"id"?: string,"last_client_activity_at"?: string | null,"max_reminders"?: number,"message"?: string | null,"next_reminder_at"?: string | null,"reminder_interval_days"?: number,"reminders_enabled"?: boolean,"reminders_sent"?: number,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"template_id"?: string | null,"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "onboarding_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "onboarding_requests_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "flow_templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "onboarding_requests_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_cents": number,"checkout_session_id": string | null,"created_at": string,"currency": string,"description": string | null,"id": string,"paid_at": string | null,"payment_intent_id": string | null,"provider": string,"provider_account_id": string | null,"receipt_url": string | null,"request_id": string,"status": Database["public"]['Enums']["payment_status"],"step_id": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"checkout_session_id"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string | null,"id"?: string,"paid_at"?: string | null,"payment_intent_id"?: string | null,"provider"?: string,"provider_account_id"?: string | null,"receipt_url"?: string | null,"request_id": string,"status"?: Database["public"]['Enums']["payment_status"],"step_id": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "amount_cents"?: number,"checkout_session_id"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string | null,"id"?: string,"paid_at"?: string | null,"payment_intent_id"?: string | null,"provider"?: string,"provider_account_id"?: string | null,"receipt_url"?: string | null,"request_id"?: string,"status"?: Database["public"]['Enums']["payment_status"],"step_id"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "onboarding_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_step_id_fkey"
      columns: ["step_id"]
isOneToOne: false
      referencedRelation: "request_steps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"processed_webhook_events": {
                  Row: {
                    "id": string,"processed_at": string,"provider": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"processed_at"?: string,"provider": string,"type": string
                  }
                  Update: {
                    "id"?: string,"processed_at"?: string,"provider"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"current_workspace_id": string | null,"email": string,"full_name": string | null,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"current_workspace_id"?: string | null,"email": string,"full_name"?: string | null,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"current_workspace_id"?: string | null,"email"?: string,"full_name"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_current_workspace_id_fkey"
      columns: ["current_workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count": number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"request_steps": {
                  Row: {
                    "completed_at": string | null,"config": NonNullable<Json>,"created_at": string,"data": NonNullable<Json>,"description": string | null,"id": string,"position": number,"request_id": string,"required": boolean,"status": Database["public"]['Enums']["step_status"],"title": string,"type": Database["public"]['Enums']["step_type"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"config"?: NonNullable<Json>,"created_at"?: string,"data"?: NonNullable<Json>,"description"?: string | null,"id"?: string,"position": number,"request_id": string,"required"?: boolean,"status"?: Database["public"]['Enums']["step_status"],"title": string,"type": Database["public"]['Enums']["step_type"],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"config"?: NonNullable<Json>,"created_at"?: string,"data"?: NonNullable<Json>,"description"?: string | null,"id"?: string,"position"?: number,"request_id"?: string,"required"?: boolean,"status"?: Database["public"]['Enums']["step_status"],"title"?: string,"type"?: Database["public"]['Enums']["step_type"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_steps_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "onboarding_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_steps_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"signatures": {
                  Row: {
                    "agreement_body": string,"agreement_title": string,"consent_text": string,"document_hash": string,"id": string,"ip_address": string | null,"pdf_path": string | null,"request_id": string,"signature_data": string,"signature_type": string,"signed_at": string,"signer_email": string,"signer_name": string,"step_id": string,"user_agent": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agreement_body": string,"agreement_title": string,"consent_text": string,"document_hash": string,"id"?: string,"ip_address"?: string | null,"pdf_path"?: string | null,"request_id": string,"signature_data": string,"signature_type": string,"signed_at"?: string,"signer_email": string,"signer_name": string,"step_id": string,"user_agent"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "agreement_body"?: string,"agreement_title"?: string,"consent_text"?: string,"document_hash"?: string,"id"?: string,"ip_address"?: string | null,"pdf_path"?: string | null,"request_id"?: string,"signature_data"?: string,"signature_type"?: string,"signed_at"?: string,"signer_email"?: string,"signer_name"?: string,"step_id"?: string,"user_agent"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "signatures_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "onboarding_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "signatures_step_id_fkey"
      columns: ["step_id"]
isOneToOne: true
      referencedRelation: "request_steps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "signatures_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["member_role"],"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_profile_fk"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "billing_customer_id": string | null,"billing_status": string | null,"billing_subscription_id": string | null,"brand_color": string,"created_at": string,"created_by": string | null,"id": string,"logo_url": string | null,"max_reminders": number,"name": string,"plan": Database["public"]['Enums']["plan_tier"],"reminder_interval_days": number,"slug": string,"stripe_account_id": string | null,"stripe_charges_enabled": boolean,"support_email": string | null,"updated_at": string,"website": string | null,"welcome_message": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "billing_customer_id"?: string | null,"billing_status"?: string | null,"billing_subscription_id"?: string | null,"brand_color"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"logo_url"?: string | null,"max_reminders"?: number,"name": string,"plan"?: Database["public"]['Enums']["plan_tier"],"reminder_interval_days"?: number,"slug": string,"stripe_account_id"?: string | null,"stripe_charges_enabled"?: boolean,"support_email"?: string | null,"updated_at"?: string,"website"?: string | null,"welcome_message"?: string | null
                  }
                  Update: {
                    "billing_customer_id"?: string | null,"billing_status"?: string | null,"billing_subscription_id"?: string | null,"brand_color"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"logo_url"?: string | null,"max_reminders"?: number,"name"?: string,"plan"?: Database["public"]['Enums']["plan_tier"],"reminder_interval_days"?: number,"slug"?: string,"stripe_account_id"?: string | null,"stripe_charges_enabled"?: boolean,"support_email"?: string | null,"updated_at"?: string,"website"?: string | null,"welcome_message"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_workspace":
{ Args: { "p_name": string,"p_slug": string }; Returns: string
                           },
"has_workspace_role":
{ Args: { "roles": (Database["public"]['Enums']["member_role"])[],"ws": string }; Returns: boolean
                           },
"is_workspace_member":
{ Args: { "ws": string }; Returns: boolean
                           },
"rate_limit_hit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           }
          }
          Enums: {
            "actor_type": "member"|"client"|"system","document_status": "pending"|"approved"|"rejected","member_role": "owner"|"admin"|"member","payment_status": "unpaid"|"pending"|"paid"|"failed"|"refunded","plan_tier": "free"|"solo"|"agency"|"scale","request_status": "draft"|"sent"|"in_progress"|"completed"|"cancelled","step_status": "not_started"|"in_progress"|"completed","step_type": "form"|"files"|"access"|"agreement"|"payment"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "actor_type": ["member", "client", "system"],"document_status": ["pending", "approved", "rejected"],"member_role": ["owner", "admin", "member"],"payment_status": ["unpaid", "pending", "paid", "failed", "refunded"],"plan_tier": ["free", "solo", "agency", "scale"],"request_status": ["draft", "sent", "in_progress", "completed", "cancelled"],"step_status": ["not_started", "in_progress", "completed"],"step_type": ["form", "files", "access", "agreement", "payment"]
          }
        }
} as const
