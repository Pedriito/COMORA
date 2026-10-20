export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_activations: {
        Row: {
          church_id: string
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_activations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      arrangements: {
        Row: {
          audio_url: string | null
          bpm: number | null
          chord_chart: string | null
          chord_chart_key: string | null
          church_id: string
          created_at: string
          id: string
          keys_available: string[] | null
          length_seconds: number | null
          name: string
          notes: string | null
          slide_style: Json | null
          song_id: string
          tags: string[] | null
          youtube_url: string | null
        }
        Insert: {
          audio_url?: string | null
          bpm?: number | null
          chord_chart?: string | null
          chord_chart_key?: string | null
          church_id?: string
          created_at?: string
          id?: string
          keys_available?: string[] | null
          length_seconds?: number | null
          name?: string
          notes?: string | null
          slide_style?: Json | null
          song_id: string
          tags?: string[] | null
          youtube_url?: string | null
        }
        Update: {
          audio_url?: string | null
          bpm?: number | null
          chord_chart?: string | null
          chord_chart_key?: string | null
          church_id?: string
          created_at?: string
          id?: string
          keys_available?: string[] | null
          length_seconds?: number | null
          name?: string
          notes?: string | null
          slide_style?: Json | null
          song_id?: string
          tags?: string[] | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arrangements_song_id_church_id_fkey"
            columns: ["song_id", "church_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      blockout_dates: {
        Row: {
          church_id: string
          created_at: string
          end_date: string
          id: string
          member_id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          church_id?: string
          created_at?: string
          end_date: string
          id?: string
          member_id: string
          reason?: string | null
          start_date: string
        }
        Update: {
          church_id?: string
          created_at?: string
          end_date?: string
          id?: string
          member_id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "blockout_dates_member_id_church_id_fkey"
            columns: ["member_id", "church_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      calendar_feeds: {
        Row: {
          church_id: string
          created_at: string
          id: string
          revoked_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          church_id?: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          token_hash: string
          user_id?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_feeds_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_memberships: {
        Row: {
          church_id: string
          created_at: string
          id: string
          is_pastoral: boolean
          role: string
          status: string
          user_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          is_pastoral?: boolean
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          is_pastoral?: boolean
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_memberships_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_schedules: {
        Row: {
          active: boolean
          church_id: string
          created_at: string
          day_of_week: string
          end_time: string | null
          event_name: string
          id: string
          sort_order: number
          start_time: string
          subtitle: string | null
        }
        Insert: {
          active?: boolean
          church_id: string
          created_at?: string
          day_of_week: string
          end_time?: string | null
          event_name: string
          id?: string
          sort_order?: number
          start_time: string
          subtitle?: string | null
        }
        Update: {
          active?: boolean
          church_id?: string
          created_at?: string
          day_of_week?: string
          end_time?: string | null
          event_name?: string
          id?: string
          sort_order?: number
          start_time?: string
          subtitle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "church_schedules_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_settings: {
        Row: {
          address_city: string
          address_dept: string
          address_street: string
          address_zip: string
          church_id: string
          email: string
          maps_url: string
          pastors_names: string
          pastors_photo_url: string
          tagline: string
          updated_at: string
          youtube_channel_id: string | null
          youtube_url: string
        }
        Insert: {
          address_city?: string
          address_dept?: string
          address_street?: string
          address_zip?: string
          church_id: string
          email?: string
          maps_url?: string
          pastors_names?: string
          pastors_photo_url?: string
          tagline?: string
          updated_at?: string
          youtube_channel_id?: string | null
          youtube_url?: string
        }
        Update: {
          address_city?: string
          address_dept?: string
          address_street?: string
          address_zip?: string
          church_id?: string
          email?: string
          maps_url?: string
          pastors_names?: string
          pastors_photo_url?: string
          tagline?: string
          updated_at?: string
          youtube_channel_id?: string | null
          youtube_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_settings_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: true
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          billing_status: string
          branding: Json
          city: string | null
          country: string
          created_at: string
          id: string
          is_founder: boolean
          is_solidarity: boolean
          modules: Json
          name: string
          offer: string | null
          size_bracket: string | null
          slug: string
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_status?: string
          branding?: Json
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          is_founder?: boolean
          is_solidarity?: boolean
          modules?: Json
          name: string
          offer?: string | null
          size_bracket?: string | null
          slug: string
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_status?: string
          branding?: Json
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          is_founder?: boolean
          is_solidarity?: boolean
          modules?: Json
          name?: string
          offer?: string | null
          size_bracket?: string | null
          slug?: string
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      decisions: {
        Row: {
          church_id: string
          context: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          source: string | null
          status: string
          team_id: string | null
          title: string
        }
        Insert: {
          church_id?: string
          context?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          source?: string | null
          status?: string
          team_id?: string | null
          title: string
        }
        Update: {
          church_id?: string
          context?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          source?: string | null
          status?: string
          team_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_team_id_church_id_fkey"
            columns: ["team_id", "church_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      early_access_accounts: {
        Row: {
          created_at: string
          eglise: string
          id: string
          nom: string
          role: string | null
          waitlist_id: string | null
        }
        Insert: {
          created_at?: string
          eglise: string
          id: string
          nom: string
          role?: string | null
          waitlist_id?: string | null
        }
        Update: {
          created_at?: string
          eglise?: string
          id?: string
          nom?: string
          role?: string | null
          waitlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "early_access_accounts_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          waitlist_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          waitlist_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          waitlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_tokens: {
        Row: {
          church_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          max_uses: number | null
          revoked_at: string | null
          token_hash: string
          uses_count: number
        }
        Insert: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          max_uses?: number | null
          revoked_at?: string | null
          token_hash: string
          uses_count?: number
        }
        Update: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          max_uses?: number | null
          revoked_at?: string | null
          token_hash?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_tokens_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      media_files: {
        Row: {
          church_id: string
          created_at: string
          id: string
          name: string
          storage_path: string | null
          type: string
          url: string
        }
        Insert: {
          church_id?: string
          created_at?: string
          id?: string
          name: string
          storage_path?: string | null
          type?: string
          url: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          name?: string
          storage_path?: string | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_files_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      member_contacts: {
        Row: {
          birthdate: string | null
          church_id: string
          city: string | null
          email: string | null
          member_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          birthdate?: string | null
          church_id?: string
          city?: string | null
          email?: string | null
          member_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          birthdate?: string | null
          church_id?: string
          city?: string | null
          email?: string | null
          member_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_contacts_member_id_church_id_fkey"
            columns: ["member_id", "church_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      member_positions: {
        Row: {
          church_id: string
          created_at: string
          id: string
          member_id: string
          position_id: string
        }
        Insert: {
          church_id?: string
          created_at?: string
          id?: string
          member_id: string
          position_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          member_id?: string
          position_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_positions_member_id_church_id_fkey"
            columns: ["member_id", "church_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "member_positions_position_id_church_id_fkey"
            columns: ["position_id", "church_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      members: {
        Row: {
          church_id: string
          created_at: string
          desired_frequency: string | null
          first_name: string
          id: string
          last_name: string
          status: string
          user_id: string | null
        }
        Insert: {
          church_id?: string
          created_at?: string
          desired_frequency?: string | null
          first_name: string
          id?: string
          last_name?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          church_id?: string
          created_at?: string
          desired_frequency?: string | null
          first_name?: string
          id?: string
          last_name?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      pastoral_notes: {
        Row: {
          church_id: string
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          note_date: string
          notes: string
          type: string
        }
        Insert: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id: string
          note_date?: string
          notes: string
          type?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string
          note_date?: string
          notes?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pastoral_notes_member_id_church_id_fkey"
            columns: ["member_id", "church_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      plan_announcements: {
        Row: {
          body: string
          church_id: string
          created_at: string
          id: string
          image_url: string | null
          order_index: number
          plan_id: string
          title: string | null
          video_url: string | null
        }
        Insert: {
          body: string
          church_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          order_index?: number
          plan_id: string
          title?: string | null
          video_url?: string | null
        }
        Update: {
          body?: string
          church_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          order_index?: number
          plan_id?: string
          title?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_announcements_plan_id_church_id_fkey"
            columns: ["plan_id", "church_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      plan_assignments: {
        Row: {
          church_id: string
          created_at: string
          external_email: string | null
          external_name: string | null
          id: string
          invitation_sent_at: string | null
          member_id: string | null
          plan_id: string
          position_id: string | null
          reminder_sent_days: number[]
          status: string
          team_id: string | null
        }
        Insert: {
          church_id?: string
          created_at?: string
          external_email?: string | null
          external_name?: string | null
          id?: string
          invitation_sent_at?: string | null
          member_id?: string | null
          plan_id: string
          position_id?: string | null
          reminder_sent_days?: number[]
          status?: string
          team_id?: string | null
        }
        Update: {
          church_id?: string
          created_at?: string
          external_email?: string | null
          external_name?: string | null
          id?: string
          invitation_sent_at?: string | null
          member_id?: string | null
          plan_id?: string
          position_id?: string | null
          reminder_sent_days?: number[]
          status?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_assignments_member_id_church_id_fkey"
            columns: ["member_id", "church_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "plan_assignments_plan_id_church_id_fkey"
            columns: ["plan_id", "church_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "plan_assignments_position_id_church_id_fkey"
            columns: ["position_id", "church_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "plan_assignments_team_id_church_id_fkey"
            columns: ["team_id", "church_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      plan_sermons: {
        Row: {
          church_id: string
          created_at: string
          id: string
          plan_id: string
          storage_path: string | null
          title: string
          url: string
        }
        Insert: {
          church_id?: string
          created_at?: string
          id?: string
          plan_id: string
          storage_path?: string | null
          title: string
          url: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          plan_id?: string
          storage_path?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_sermons_plan_id_church_id_fkey"
            columns: ["plan_id", "church_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      plan_share_links: {
        Row: {
          church_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          plan_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          plan_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          plan_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_share_links_plan_id_church_id_fkey"
            columns: ["plan_id", "church_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      plan_songs: {
        Row: {
          arrangement_id: string | null
          church_id: string
          created_at: string
          id: string
          key_selected: string | null
          order_index: number
          plan_id: string
          song_id: string
        }
        Insert: {
          arrangement_id?: string | null
          church_id?: string
          created_at?: string
          id?: string
          key_selected?: string | null
          order_index?: number
          plan_id: string
          song_id: string
        }
        Update: {
          arrangement_id?: string | null
          church_id?: string
          created_at?: string
          id?: string
          key_selected?: string | null
          order_index?: number
          plan_id?: string
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_songs_arrangement_id_church_id_fkey"
            columns: ["arrangement_id", "church_id"]
            isOneToOne: false
            referencedRelation: "arrangements"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "plan_songs_plan_id_church_id_fkey"
            columns: ["plan_id", "church_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "plan_songs_song_id_church_id_fkey"
            columns: ["song_id", "church_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      plan_videos: {
        Row: {
          church_id: string
          created_at: string
          id: string
          order_index: number
          plan_id: string
          title: string | null
          url: string
        }
        Insert: {
          church_id?: string
          created_at?: string
          id?: string
          order_index?: number
          plan_id: string
          title?: string | null
          url: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          order_index?: number
          plan_id?: string
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_videos_plan_id_church_id_fkey"
            columns: ["plan_id", "church_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      plans: {
        Row: {
          church_id: string
          created_at: string
          excluded_position_ids: string[] | null
          id: string
          notes: string | null
          plan_type: string
          service_date: string
          team_id: string | null
          team_ids: string[] | null
          title: string
        }
        Insert: {
          church_id?: string
          created_at?: string
          excluded_position_ids?: string[] | null
          id?: string
          notes?: string | null
          plan_type?: string
          service_date: string
          team_id?: string | null
          team_ids?: string[] | null
          title: string
        }
        Update: {
          church_id?: string
          created_at?: string
          excluded_position_ids?: string[] | null
          id?: string
          notes?: string | null
          plan_type?: string
          service_date?: string
          team_id?: string | null
          team_ids?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_team_id_church_id_fkey"
            columns: ["team_id", "church_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          allow_multiple: boolean
          archived: boolean
          church_id: string
          created_at: string
          id: string
          name: string
          team_id: string
        }
        Insert: {
          allow_multiple?: boolean
          archived?: boolean
          church_id?: string
          created_at?: string
          id?: string
          name: string
          team_id: string
        }
        Update: {
          allow_multiple?: boolean
          archived?: boolean
          church_id?: string
          created_at?: string
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_team_id_church_id_fkey"
            columns: ["team_id", "church_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      prayer_requests: {
        Row: {
          church_id: string
          created_at: string
          created_by: string | null
          id: string
          member_id: string | null
          notes: string | null
          person_name: string | null
          resolved_at: string | null
          status: string
          subject: string
        }
        Insert: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          person_name?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          person_name?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_requests_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_requests_member_id_church_id_fkey"
            columns: ["member_id", "church_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_church_id: string | null
          avatar_url: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string
        }
        Insert: {
          active_church_id?: string | null
          avatar_url?: string | null
          created_at?: string
          first_name?: string
          id: string
          last_name?: string
        }
        Update: {
          active_church_id?: string | null
          avatar_url?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_church_id_fkey"
            columns: ["active_church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      projection_settings: {
        Row: {
          ann_bg_blur: number
          ann_bg_color: string
          ann_bg_gradient: string | null
          ann_bg_image_url: string | null
          ann_bg_overlay_opacity: number
          ann_bg_type: string
          ann_font_family: string
          ann_font_size_scale: number
          ann_text_color: string
          ann_text_max_width: number
          ann_text_shadow: boolean
          ann_text_transform: string
          ann_title_font_size_scale: number
          bg_blur: number
          bg_color: string
          bg_gradient: string | null
          bg_image_url: string | null
          bg_type: string
          church_id: string
          font_family: string
          font_size_scale: number
          overlay_opacity: number
          text_color: string
          text_max_width: number
          text_shadow: boolean
          text_transform: string
          updated_at: string
        }
        Insert: {
          ann_bg_blur?: number
          ann_bg_color?: string
          ann_bg_gradient?: string | null
          ann_bg_image_url?: string | null
          ann_bg_overlay_opacity?: number
          ann_bg_type?: string
          ann_font_family?: string
          ann_font_size_scale?: number
          ann_text_color?: string
          ann_text_max_width?: number
          ann_text_shadow?: boolean
          ann_text_transform?: string
          ann_title_font_size_scale?: number
          bg_blur?: number
          bg_color?: string
          bg_gradient?: string | null
          bg_image_url?: string | null
          bg_type?: string
          church_id?: string
          font_family?: string
          font_size_scale?: number
          overlay_opacity?: number
          text_color?: string
          text_max_width?: number
          text_shadow?: boolean
          text_transform?: string
          updated_at?: string
        }
        Update: {
          ann_bg_blur?: number
          ann_bg_color?: string
          ann_bg_gradient?: string | null
          ann_bg_image_url?: string | null
          ann_bg_overlay_opacity?: number
          ann_bg_type?: string
          ann_font_family?: string
          ann_font_size_scale?: number
          ann_text_color?: string
          ann_text_max_width?: number
          ann_text_shadow?: boolean
          ann_text_transform?: string
          ann_title_font_size_scale?: number
          bg_blur?: number
          bg_color?: string
          bg_gradient?: string | null
          bg_image_url?: string | null
          bg_type?: string
          church_id?: string
          font_family?: string
          font_size_scale?: number
          overlay_opacity?: number
          text_color?: string
          text_max_width?: number
          text_shadow?: boolean
          text_transform?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projection_settings_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: true
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_announcements: {
        Row: {
          active: boolean
          body: string
          church_id: string
          created_at: string
          id: string
          image_url: string | null
          order_index: number
          title: string | null
          video_url: string | null
        }
        Insert: {
          active?: boolean
          body: string
          church_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          order_index?: number
          title?: string | null
          video_url?: string | null
        }
        Update: {
          active?: boolean
          body?: string
          church_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          order_index?: number
          title?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_announcements_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          ccli: string | null
          church_id: string
          created_at: string
          id: string
          last_scheduled_date: string | null
          notes: string | null
          themes: string | null
          title: string
        }
        Insert: {
          ccli?: string | null
          church_id?: string
          created_at?: string
          id?: string
          last_scheduled_date?: string | null
          notes?: string | null
          themes?: string | null
          title: string
        }
        Update: {
          ccli?: string | null
          church_id?: string
          created_at?: string
          id?: string
          last_scheduled_date?: string | null
          notes?: string | null
          themes?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "songs_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          church_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          status: string
          team_id: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          church_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          status?: string
          team_id: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          church_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          status?: string
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_church_id_fkey"
            columns: ["assigned_to", "church_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "tasks_team_id_church_id_fkey"
            columns: ["team_id", "church_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      team_members: {
        Row: {
          church_id: string
          created_at: string
          frequency: string | null
          id: string
          member_id: string
          role: string
          team_id: string
        }
        Insert: {
          church_id?: string
          created_at?: string
          frequency?: string | null
          id?: string
          member_id: string
          role?: string
          team_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          frequency?: string | null
          id?: string
          member_id?: string
          role?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_member_id_church_id_fkey"
            columns: ["member_id", "church_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "team_members_team_id_church_id_fkey"
            columns: ["team_id", "church_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      teams: {
        Row: {
          allows_guests: boolean
          church_id: string
          created_at: string
          description: string | null
          hide_positions: boolean
          id: string
          is_coordination: boolean
          is_prayer_meeting: boolean
          name: string
        }
        Insert: {
          allows_guests?: boolean
          church_id?: string
          created_at?: string
          description?: string | null
          hide_positions?: boolean
          id?: string
          is_coordination?: boolean
          is_prayer_meeting?: boolean
          name: string
        }
        Update: {
          allows_guests?: boolean
          church_id?: string
          created_at?: string
          description?: string | null
          hide_positions?: boolean
          id?: string
          is_coordination?: boolean
          is_prayer_meeting?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          benevoles: string | null
          created_at: string
          cultes: string | null
          decided_at: string | null
          eglise: string
          email: string
          email_sent_at: string | null
          id: string
          ministeres: string[]
          multi_sites: boolean
          nom: string
          outil: string | null
          pays: string | null
          priorite: string | null
          role: string | null
          source: string | null
          statut: string
          taille: string | null
          ville: string
          visio: boolean
        }
        Insert: {
          benevoles?: string | null
          created_at?: string
          cultes?: string | null
          decided_at?: string | null
          eglise: string
          email: string
          email_sent_at?: string | null
          id?: string
          ministeres?: string[]
          multi_sites?: boolean
          nom: string
          outil?: string | null
          pays?: string | null
          priorite?: string | null
          role?: string | null
          source?: string | null
          statut?: string
          taille?: string | null
          ville: string
          visio?: boolean
        }
        Update: {
          benevoles?: string | null
          created_at?: string
          cultes?: string | null
          decided_at?: string | null
          eglise?: string
          email?: string
          email_sent_at?: string | null
          id?: string
          ministeres?: string[]
          multi_sites?: boolean
          nom?: string
          outil?: string | null
          pays?: string | null
          priorite?: string | null
          role?: string | null
          source?: string | null
          statut?: string
          taille?: string | null
          ville?: string
          visio?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_invite_token: { Args: { target_hash: string }; Returns: string }
      current_church_id: { Args: never; Returns: string }
      has_church_role: {
        Args: { required_role: string; target_church: string }
        Returns: boolean
      }
      is_church_member: { Args: { target_church: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_team_member: { Args: { target_team: string }; Returns: boolean }
      my_member_id: { Args: { target_church: string }; Returns: string }
      public_church_site: { Args: { target_slug: string }; Returns: Json }
      realtime_church_id: { Args: { topic: string }; Returns: string }
      rls_audit: {
        Args: never
        Returns: {
          rls_enabled: boolean
          rls_forced: boolean
          table_name: string
        }[]
      }
      storage_church_id: { Args: { object_name: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

